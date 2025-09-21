import { Body, Inject, Injectable, Param, Post } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { AuthService } from "../auth/auth.service";
import * as bcrypt from "bcrypt"
import camelcaseKeys from "camelcase-keys";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, compareAsc, differenceInMinutes } from 'date-fns';
import { id, ptBR } from 'date-fns/locale';
import { getFullMonthInterval } from "src/utils/get-full-month-interval";
import { flattenObject } from "src/utils/flatten-object";
import { FinanceService } from "../finance/finance.service";
import { BodyAsset, CreateEmployeeBody, EventSpace, InterventionBody, InterventionPayment, UpdateEmployeeScheduleBody } from "./types/dto/structure.dto";
import { translateComplexDurationToEnglish } from "src/utils/translation-duration-to-english";
import { normalizeFileName } from "src/utils/normalize-file-name";
import { v4 } from "uuid";

@Injectable()
export class StructureService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly financeService: FinanceService,
    private readonly authService: AuthService
  ) { }

  async getWorkAreasOptions() {
    const { data, error } = await this.supabase.from('work_areas').select('*');
    if (error) throw new Error(error.message);
    return data;
  }

  async getEmployeeStatusOptions() {
    const { data, error } = await this.supabase.from('employee_status').select('*');
    if (error) throw new Error(error.message);
    return data;
  }


  async getEmployeeRolesOptions() {
    const { data, error } = await this.supabase.from('employee_roles').select('*');
    if (error) throw new Error(error.message);
    return data;
  }

  async createEmployee(data: CreateEmployeeBody) {
    const {
      employeeRoleId,
      name,
      cpf,
      phoneNumber,
      salary,
      status,
      workAreaId,
      condominiumId,
      email,
      password
    } = data;
    const { data: roles, error: errorRoles } = await this.supabase
      .from('employee_roles')
      .select("*")
      .eq('id', employeeRoleId);

    if (errorRoles) {
      throw new Error(errorRoles.message)
    }
    const currentRoleHasLogin = roles?.[0]?.has_login;
    let userLoginId = null;

    if (currentRoleHasLogin && email && password) {
      const passwordHashed = await bcrypt.hash(password, 8);
      const { error: insertUserError } = await this.supabase
        .from('user')
        .insert(
          {
            name,
            email,
            phone: phoneNumber,
            password: passwordHashed,
            created_at: new Date,
            cpf,
          }
        );
      if (insertUserError) {
        throw new Error(insertUserError.message)
      }
      const { data: users, error: usersError } = await this.supabase
        .from("user")
        .select("id")
        .eq('email', email);

      if (usersError) {
        throw new Error(usersError.message)
      }

      userLoginId = users?.[0]?.id;

      const { data: _, error: userAssociationError } = await this.supabase.from('user_association').insert({
        user_id: userLoginId,
        condominium_id: condominiumId,
        role: 'employee',
        created_at: new Date()
      })

      if (userAssociationError) {
        throw new Error(userAssociationError.message)
      }
    }

    const { data: _, error: employeeInsertError } = await this.supabase.from('employees').insert({
      name,
      cpf,
      salary: Number(data.salary),
      employee_role_id: employeeRoleId,
      user_id: userLoginId,
      phone_number: phoneNumber,
      work_area_id: workAreaId,
      status_id: status,
      condominium_id: condominiumId,
    })

    if (employeeInsertError) {
      throw new Error(employeeInsertError.message)
    }
  }

  async getEmployees(condominiumId: string) {
    const { data: employees, error: employeesError } = await this.supabase
      .from("employees")
      .select(`*,
        employee_roles (*)
        `)
      .eq('condominium_id', condominiumId);

    if (employeesError) {
      throw new Error(employeesError.message);
    }


    const promissesEmployeesWithEmail = employees?.map(async employee => {


      const userId = employee?.user_id ?? -1
      const {
        data: userInfo,
        error: userInfoError
      } = await this.supabase
        .from("user")
        .select('*')
        .eq('id', userId);

      if (userInfoError) {
        throw new Error(userInfoError.message)
      }

      const user = userInfo?.[0];
      return {
        email: user?.email,
        ...employee,
      }
    })


    return camelcaseKeys(await Promise.all(promissesEmployeesWithEmail))
  }

  async updateEmployee(data: any) {
    const { data: employees, error: employeesError } = await this.supabase
      .from("employees")
      .select('*')
      .eq('id', data.employeeId);

    if (employeesError) {
      throw new Error(employeesError.message)
    }
    const currentEmployeeId = employees?.[0]?.user_id ?? -1
    const { data: users, error: usersError } = await this.supabase
      .from('user')
      .select("*")
      .eq('id', currentEmployeeId);

    if (usersError) {
      throw new Error(usersError.message);
    }

    const currentUser = users?.[0];
    if (currentUser && currentUser.email !== data.email || data.password) {
      const passwordHashed = data.password ?
        await bcrypt.hash(data.password, 8)
        : currentUser.password;

      const { data: updateUser, error: updateUserError } = await this.supabase
        .from('user')
        .update({
          email: data.email,
          password: passwordHashed
        }).eq('id', currentUser.id)

      if (updateUserError) {
        throw new Error(updateUserError.message)
      }

    }

    const { data: updateEmployee, error: updateEmployeeError } = await this.supabase.from("employees")
      .update({
        name: data.name,
        salary: Number(data.salary),
        cpf: data.cpf,
        employee_role_id: data.employeeRoleId,
        phone_number: data.phoneNumber,
        work_area_id: data.workAreaId,
        status_id: data.status
      })
      .eq("id", data.employeeId);

    if (updateEmployeeError) {
      throw new Error(updateEmployeeError.message)
    }

  }

  async deleteEmployee(data: any) {

    const {
      employeeId,
    } = data;

    const { data: employees, error: employeesError } = await this.supabase
      .from("employees")
      .select('user_id')
      .eq('id', employeeId);

    if (employeesError) {
      throw new Error(employeesError.message)
    }

    const currentEmployeeUser = employees?.[0];

    const { error } = await this.supabase
      .from("employees")
      .delete()
      .eq('id', employeeId);
    if (error) {
      throw new Error(error.message)
    }

    if (currentEmployeeUser?.user_id) {
      await this.supabase
        .from('user_association')
        .delete()
        .eq('user_id', currentEmployeeUser.user_id);

      const { error: deleteUserEmployeeError } = await this.supabase
        .from('user')
        .delete()
        .eq('id', currentEmployeeUser.user_id);

      if (deleteUserEmployeeError) {
        throw new Error(deleteUserEmployeeError.message)
      }
    }
  }
  getDateIntervalOfDay(input: string) {

    const [day, month, year] = input.split("-");
    const start = new Date(`${year}-${month}-${day}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1); // Soma 1 dia

    return {
      startDate: start.toISOString(), // 2025-08-05T00:00:00.000Z
      endDate: end.toISOString(),     // 2025-08-06T00:00:00.000Z
    };
  }
  async getEmployeeSchedule(params: any) {
    const {
      startDate,
      endDate
    } = this.getDateIntervalOfDay(params.date);

    const { data: employeesSchedule, error: employeesScheduleError } = await this.supabase
      .from("employees_schedule")
      .select("*")
      .eq("condominium_id", params.condominiumId)
      .gte("start_date", startDate)
      .lt("start_date", endDate);

    if (employeesScheduleError) {
      throw new Error(employeesScheduleError.message);
    }

    // Geração de horários caso ainda não existam
    if (employeesSchedule.length === 0) {
      const { data: workAreas } = await this.supabase.from("work_areas").select("id");

      const [day, month, year] = params.date.split("-");
      const baseDate = new Date(Date.UTC(+year, +month - 1, +day)); // sempre em UTC

      const allSchedules: any[] = [];

      for (const workArea of workAreas || []) {
        for (let i = 0; i < 24; i++) {
          const hourStart = new Date(baseDate.getTime());
          hourStart.setUTCHours(i, 0, 0, 0);

          const hourEnd = new Date(baseDate.getTime());
          hourEnd.setUTCHours(i + 1, 0, 0, 0);

          allSchedules.push({
            created_at: new Date().toISOString(),
            condominium_id: params.condominiumId,
            work_area_id: workArea.id,
            start_date: hourStart.toISOString(),
            end_date: hourEnd.toISOString(),
          });
        }
      }

      const { error } = await this.supabase.from("employees_schedule").insert(allSchedules);
      if (error) {
        throw new Error(error.message);
      }
    }

    // Busca dos horários existentes
    const [day, month, year] = params.date.split("-");
    const startDateFormatted = new Date(Date.UTC(+year, +month - 1, +day, 0, 0, 0)).toISOString();
    const endDateFormatted = new Date(Date.UTC(+year, +month - 1, +day, 23, 59, 59, 999)).toISOString();

    const { data } = await this.supabase
      .from("employees_schedule")
      .select(`*`)
      .eq("condominium_id", params.condominiumId)
      .gte("start_date", startDateFormatted)
      .lte("start_date", endDateFormatted)
      .order("start_date", { ascending: true });

    const schedulesWithEmployees = await Promise.all(
      (data || []).map(async (schedule) => {
        const scheduleDate = new Date(schedule.start_date);

        const { data: employees, error } = await this.supabase
          .from("employee_schedule_relation")
          .select("*")
          .eq("schedule_id", schedule.id);

        if (error) {
          console.log("Error fetching employees for schedule:", schedule.id, error);
          return null;
        }

        const employeeIds = Array.isArray(employees)
          ? employees.map(employee => employee.employee_id)
          : [];

        return {
          id: schedule.id,
          date: scheduleDate,
          workAreaId: schedule.work_area_id,
          employeeIds
        };
      })
    );

    const result: {
      id: number;
      date: Date;
      data: any[];
    }[] = [];

    for (const item of schedulesWithEmployees) {
      if (!item) continue;

      const existing = result.find(r => r.date.getTime() === item.date.getTime());

      const entry = {
        workAreaId: item.workAreaId,
        employeeIds: item.employeeIds,
      };

      if (!existing) {
        result.push({
          id: item.id,
          date: item.date,
          data: [entry],
        });
      } else {
        existing.data.push(entry);
      }
    }
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async updateScheduleEmployee(data: UpdateEmployeeScheduleBody[], condominiumId: string) {

    data.map(async item => {
      const { data: workAreasForCurrentHour, error: workAreasForCurrentHourError } = await this.supabase
        .from("employees_schedule")
        .select('*')
        .eq('condominium_id', condominiumId)
        .eq('start_date', item.shift);

      if (workAreasForCurrentHourError) {
        throw new Error(workAreasForCurrentHourError.message)
      }

      workAreasForCurrentHour.map(async workAreaCurrentHour => {
        const recordId = workAreaCurrentHour.id;
        const currentWorkArea = item.data
          .find(current => current.workAreaId === workAreaCurrentHour.work_area_id);

        const { data: employeeRelation, error: employeeRelationError } =
          await this.supabase.from("employee_schedule_relation")
            .select('*')
            .eq('schedule_id', recordId);

        if (employeeRelationError) {
          return
        }
        const employeesToSave = currentWorkArea?.employeeIds.filter(currentEmployeeId =>
          !employeeRelation.some(employeeAlreadySave => employeeAlreadySave.employee_id === currentEmployeeId));

        const employeeToDelete = employeeRelation.filter(employeeAlreadySave =>
          !currentWorkArea?.employeeIds.some(currenteEmployee => employeeAlreadySave.employee_id === currenteEmployee))

        employeeToDelete?.map(async employeeToDelete => {
          if (employeeToDelete?.employee_id) {
            await this.supabase.from('employee_schedule_relation')
              .delete().
              eq('employee_id', employeeToDelete.employee_id)
              .eq('schedule_id', employeeToDelete.schedule_id)
          }
        })

        employeesToSave?.map(async employeeId => {
          if (employeeId) {
            const { data: insertEmployeeSchedule, error } = await this.supabase.from('employee_schedule_relation').insert({
              employee_id: employeeId,
              schedule_id: recordId,
              condominium_id: condominiumId
            })

            if (error) {
              console.log('error : ', error)
            }
          }

        })
      })

    })
  }

  async getManagementSpaces(condominiumId: string) {
    const { data, error } = await this.supabase.from('condominium_areas').select("*").eq('condominium_id', condominiumId);
    if (error) throw new Error(error.message)
    return data;
  }

  async getManagementSpacesEvents(spaceEventId: string, date: string) {
    const { data: spacesEvents, error: spacesEventsError } = await this.supabase
      .from("space_events")
      .select(`*, space_event_guests (*)`)
      .eq("condominium_area_id", spaceEventId);

    if (spacesEventsError) throw new Error(spacesEventsError.message);
    const events: EventSpace[] = camelcaseKeys(spacesEvents, { deep: true });
    const parsedDate = parseISO(date);
    const allDaysOfMonth = eachDayOfInterval({
      start: startOfMonth(parsedDate),
      end: endOfMonth(parsedDate),
    });
    const daysWithEvents = allDaysOfMonth.map(day => ({
      dayNumber: day.getDate(),
      dayName: format(day, 'EEEE', { locale: ptBR }),
      date: format(day, 'yyyy-MM-dd'),
      events: [],
    }));

    for (const event of events) {
      const eventDay = daysWithEvents.find(day => day.date === event.eventDate);
      if (eventDay) {
        eventDay.events.push(event as never);
      }
    }
    for (const day of daysWithEvents) {
      day.events.sort((a: any, b: any) => compareAsc(parseISO(`1970-01-01T${a.startTime}`), parseISO(`1970-01-01T${b.startTime}`)));
    }
    return daysWithEvents;
  }

  async updateSpaceEvent(eventId, data: any) {
    const guestsToUpdate = data.guests.filter(guest => guest.id);
    const guestsToCreate = data.guests.filter(guest => !guest.id);
    const { error } = await this.supabase.from("space_events").update({
      start_time: data.startTime,
      end_time: data.endTime
    })
      .eq('id', eventId)

    if (error) throw new Error(error.message)

    await Promise.all(guestsToCreate.map(async guest => {
      const { error } = await this.supabase.from('space_event_guests').insert({
        name: guest.name,
        cpf: guest.cpf,
        space_event_id: eventId,
        created_at: new Date()
      })

      if (error) console.log("error", error)
    }))

    await Promise.all(guestsToUpdate.map(async guest => {
      await this.supabase.from('space_event_guests').update({
        name: guest.name,
        cpf: guest.cpf
      })
        .eq('id', guest.id)
    }))
  }

  async deleteGuestSpaceEvent(guestId: string) {
    const { error } = await this.supabase.from('space_event_guests').delete().eq('id', guestId)
    if (error) throw new Error(error.message)
  }

  async deleteEvent(eventId: string) {
    await this.supabase.from("space_event_guests").delete().eq("space_event_id", eventId);
    await this.supabase.from('space_events').delete().eq('id', eventId)
  }

  async createEventSpace(data: any) {
    const { error } = await this.supabase.from('space_events').insert({
      event_date: data.eventDate,
      start_time: data.startTime,
      end_time: data.endTime,
      condominium_area_id: data.condominiumAreaId,
      apartment_id: data.apartmentId
    })

    if (error) throw new Error(error.message)
  }

  async getMaintenances(date: string, token: string) {
    const { userId } = await this.authService.decodeToken(token);
    const userInfo = await this.authService.me(userId);

    const year = new Date(date).getFullYear();
    const startOfYear = format(new Date(year, 0, 1), 'yyyy-MM-dd')
    const endOfYear = format(new Date(year, 11, 31), 'yyyy-MM-dd')

    const condominiumId = userInfo.condominiumId;

    // Buscar todas as manutenções com seus payments sem filtro no supabase
    const { data: maintenances, error: maintenancesError } = await this.supabase
      .from('maintenances')
      .select(`
      *,
      maintenance_statuses(*),
      priorities (*),
      payment_methods (*),
      maintenance_types (*),
      condominium_areas (*),
      maintenance_payments(*)
    `)
      .eq('condominium_id', condominiumId);

    if (maintenancesError) {
      throw new Error(maintenancesError.message);
    }

    // Filtrar manualmente as manutenções para pegar apenas as que tenham ao menos
    // um payment com payment_date dentro do intervalo startDate-endDate
    const filteredMaintenances = maintenances.filter(maintenance =>
      maintenance.maintenance_payments.some(payment => {
        const paymentDate = new Date(payment.payment_date);
        return paymentDate >= new Date(startOfYear) && paymentDate <= new Date(endOfYear);
      })
    );

    // Se precisar formatar camelCase e flatten, adapte aqui
    const maintenancesFormatted: any[] = camelcaseKeys(filteredMaintenances.map(maintenance => flattenObject(maintenance)));

    return maintenancesFormatted;
  }


  async createMaintenance(condominiumId: string, token: string, data: InterventionBody) {
    const durationTranslateToEnglish = translateComplexDurationToEnglish(data.duration!);
    const { userId } = await this.authService.decodeToken(token);

    // Inserir manutenção
    const { data: insertedMaintenances, error } = await this.supabase
      .from('maintenances')
      .insert({
        priority_id: data.priority,
        type_id: data.type,
        description: data.description,
        supplier: data.provider,
        amount: Number(data.value),
        payment_method: data.paymentMethod,
        payment_date: data.paymentDate,
        payment_completion_date: data.paymentCompletionDate,
        condominium_area_id: data.area,
        status_id: data.status,
        created_at: new Date(),
        created_by_id: userId,
        condominium_id: condominiumId,
        planned_start: data.plannedStart,
        planned_end: data.plannedEnd,
        execution_time: durationTranslateToEnglish,
        actual_start: data.actualStart,
        actual_end: data.actualEnd,
        number_of_installments: data.numberOfInstallments,
        is_installment: data.isInstallment,
      })
      .select('id');

    if (error) throw new Error(error.message);
    if (!insertedMaintenances || insertedMaintenances.length === 0)
      throw new Error('Maintenance insertion failed.');

    const maintenanceId = insertedMaintenances[0].id;

    if (data.paymentDate) {
      const paymentsToInsert: any[] = [];

      const initialDate = new Date(data.paymentDate);
      const numberOfInstallments = data.numberOfInstallments ?? 1

      const installmentValue = Number(data.value) / numberOfInstallments;

      for (let i = 0; i < numberOfInstallments; i++) {
        const paymentDate = new Date(initialDate);
        paymentDate.setMonth(paymentDate.getMonth() + i); // soma i meses

        paymentsToInsert.push({
          maintenance_id: maintenanceId,
          payment_date: paymentDate.toISOString(),
          amount: installmentValue,
          is_installment: data.isInstallment,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      const { error: paymentsError } = await this.supabase
        .from('maintenance_payments')
        .insert(paymentsToInsert);

      if (paymentsError) throw new Error(paymentsError.message);
    }

    return { maintenanceId }; // ou retornar outra coisa que precisar
  }


  async updateMaintenance(token: string, data: any, maintenanceId: string) {

    const { userId } = await this.authService.decodeToken(token);

    const durationTranslateToEnglish = translateComplexDurationToEnglish(data.duration!);

    const userInfo = await this.authService.me(userId);

    const condominiumId = userInfo.condominiumId;

    const { error } = await this.supabase.from('maintenances').update({
      priority_id: data.priority,
      type_id: data.type,
      description: data.description,
      supplier: data.provider,
      amount: Number(data.value),
      payment_method: data.paymentMethod,
      payment_date: data.paymentDate,
      payment_completion_date: data.paymentCompletionDate,
      condominium_area_id: data.area,
      status_id: data.status,
      created_at: new Date(),
      created_by_id: userId,
      condominium_id: condominiumId,
      planned_start: data.plannedStart,
      planned_end: data.plannedEnd,
      execution_time: durationTranslateToEnglish,
      actual_start: data.actualStart,
      actual_end: data.actualEnd
    })
      .eq('id', maintenanceId);


    const installmentValue = Number(data.value) / data.numberOfInstallments
    await this.supabase.from('maintenance_payments')
      .update({
        amount: Number(installmentValue),
      })
      .eq('maintenance_id', maintenanceId);

    if (error) throw new Error(error.message);

  }

  async deleteMaintenance(maintenanceId: string) {
    const { error } = await this.supabase
      .from('maintenances')
      .delete()
      .eq('id', maintenanceId);
    if (error) throw new Error(error.message)
  }

  async getPriorityOptions() {
    const { data, error } = (await this.supabase.from('priorities').select("*"));
    if (error) throw new Error(error.message);
    return data;
  }

  async getMaintenancesStatus() {
    const { data, error } = (await this.supabase.from('maintenance_statuses').select("*"));
    if (error) throw new Error(error.message);
    return data;
  }

  async getMaintenancesTypesOptions() {
    const { data, error } = await this.supabase.from("maintenance_types").select('*');
    if (error) throw new Error(error?.message)
    return data
  }


  async getPaymentMethodsOptions() {
    const { data, error } = (await this.supabase.from('payment_methods').select("*"));
    if (error) throw new Error(error.message);
    return data;
  }

  async getAreas(condominiumId: string) {
    const { data, error } = await this.supabase.from("condominium_areas").select('*').eq('condominium_id', condominiumId);
    if (error) throw new Error(error.message)
    return data;
  }

  async getMaintenaneCards(date: string, token: string) {
    const currentDate = format(new Date(), 'yyyy-MM-dd')
    const {
      startDate,
      endDate
    } = getFullMonthInterval(currentDate);

    const year = new Date(date).getFullYear();
    const startOfYear = format(new Date(year, 0, 1), 'yyyy-MM-dd')
    const endOfYear = format(new Date(year, 11, 31), 'yyyy-MM-dd')

    const { userId } = await this.authService.decodeToken(token);
    const userInfo = await this.authService.me(userId);

    const { data: maintenancePayments, error } = await this.supabase
      .from('maintenance_payments')
      .select(`*, maintenances (*)`)

      .gte('payment_date', startOfYear)
      .lte('payment_date', endOfYear)

    if (error) {
      throw new Error(error.message);
    }

    const maintenancesPaymentsFilteredByCondominium =
      maintenancePayments?.filter(payment => payment.maintenances.condominium_id === userInfo.condominiumId);

    const cardsFinance = await this.financeService.cardsFinancialEntry({
      condominiumId: userInfo.condominiumId,
      startDate,
      endDate,
    });

    const maintenancePaymentsFormatted =
      camelcaseKeys(maintenancesPaymentsFilteredByCondominium.map(maintenance => flattenObject(maintenance))) as InterventionPayment[]

    const monthCurrentDate = startDate.slice(0, 7)

    const newMonthlyFixedCosts = maintenancePaymentsFormatted.reduce((total, intervention) => {
      const paymentDate = intervention.paymentDate.slice(0, 7)

      const monthIsMatch = paymentDate === monthCurrentDate
      const shouldCount =
        monthIsMatch &&
        (
          (intervention.isInstallment && intervention.maintenancesStatusId !== 4) ||
          intervention.maintenanceId !== 3
        )

      return total + (shouldCount ? intervention.amount : 0)
    }, 0)

    const uniqueRegistersId = new Set(maintenancePaymentsFormatted.map(item => item.maintenanceId));
    const approvedImprovementsCost = maintenancePaymentsFormatted.reduce((acc, intervention) => {
      if (uniqueRegistersId.has(intervention.maintenanceId)) {
        uniqueRegistersId.delete(intervention.maintenanceId)
        return acc += intervention.maintenancesAmount;
      }
      return acc;
    }, 0);

    const result = {
      newMonthlyFixedCosts,
      approvedImprovementsCost,
      balance: cardsFinance.accumulatedBalance,
    }
    return result
  }

  async getAssetsCategoryOptions() {
    const { data, error } = await this.supabase.from('asset_categories').select("*");
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async getAssetsStatusOptions() {
    const { data, error } = await this.supabase.from('asset_status').select("*");
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async createAsset(condominiumId: string, data: BodyAsset, photos: any) {
    let photoUrl: string = '';

    if (photos.length > 0) {
      const currentPhoto = photos[0];
      const fileName = normalizeFileName(currentPhoto.originalname)
      const uniqueFileName = `${v4()}-${fileName}`;
      const { data: fileData, error } = await this.supabase.storage
        .from('condo')
        .upload(`uploads/${uniqueFileName}`, currentPhoto.buffer);
      if (error) {
        throw new Error(error.message)
      }
      photoUrl = fileData.fullPath;
    }

    const { data: assets, error } = await this.supabase.from('assets').insert({
      photo_url: photoUrl,
      name: data.item,
      code_item: data.code,
      area_id: data.areaId,
      category_id: data.categoryId,
      status_id: data.statusId,
      condominium_id: condominiumId,
      created_at: new Date(),
    });

    if (error) {
      throw new Error(error.message)
    }
    const currentAssetInserted = data?.[0];
    return currentAssetInserted
  }

  async getAssets(condominiumId: string) {
    const { data: assets, error } = await this.supabase
      .from('assets')
      .select(`*, 
        asset_categories (*),
        asset_status (*),
        condominium_areas (*),
        asset_reports (*)
        `)
      .eq('condominium_id', condominiumId);

    if (error) {
      throw new Error(error.message)
    }

    const assetsFlatten: any = assets.map(asset => flattenObject(asset));

    const assetsWithPublicUrlPhoto = await Promise.all(assetsFlatten.map(async (asset) => {
      const path = asset.photo_url;
      let publicUrlAsset = ''

      if (path) {
        const [_, ...pathFormatted] = path?.split('/');
        const {
          data
        } = this.supabase.storage
          .from('condo')
          .getPublicUrl(`${pathFormatted.join('/')}`);

        const {
          publicUrl
        } = data;

        publicUrlAsset = publicUrl;

      }

      return {
        ...asset,
        reportCount: asset.asset_reports.length,
        publicUrl: publicUrlAsset
      }
    }))

    return camelcaseKeys(assetsWithPublicUrlPhoto)
  }

  async updateAsset(assetId: string, data: BodyAsset) {

    const { data: assets, error } = await this.supabase
      .from('assets')
      .update({
        name: data.item,
        code_item: data.code,
        area_id: data.areaId,
        category_id: data.categoryId,
        status_id: data.statusId,
        updated_at: new Date(),
      })
      .eq('id', assetId)
      .select('*')

    if (error) {
      throw new Error(error.message);
    }

    const curretAssetInserted = assets?.[0];

    return curretAssetInserted;
  }

  async deleteAsset(assetId: string) {
    const { data: assets, error: assetsError } = await this.supabase
      .from('assets')
      .select('*')
      .eq('id', assetId);

    if (assetsError) {
      throw new Error(assetsError?.message)
    }

    const currentAsset = assets?.[0];

    if (currentAsset.photo_url) {
      const [_, ...path] = currentAsset.photo_url.split('/');
      const pathFormatted = path.join('/');
      const { error: errorDeleteImage } = await this.supabase.storage
        .from('condo')
        .remove([pathFormatted]);
      if (errorDeleteImage) {
        throw new Error(errorDeleteImage.message)
      }
    }

    const { error } = await this.supabase
      .from('assets')
      .delete()
      .eq('id', assetId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async updateAssetImage(assetId, photo) {
    let photoUrl = '';

    const { data: assets, error } = await this.supabase
      .from('assets')
      .select("*")
      .eq('id', assetId);

    if (error) {
      throw new Error(error.message)
    }

    const currentAsset = assets?.[0];

    if (currentAsset.photo_url) {
      const [_, ...path] = currentAsset.photo_url.split('/');
      const pathFormatted = path.join('/');
      const { error: errorDeleteImage } = await this.supabase.storage
        .from('condo')
        .remove([pathFormatted]);
      if (errorDeleteImage) {
        throw new Error(errorDeleteImage.message)
      }
    }

    const currentPhoto = photo[0];

    const fileName = normalizeFileName(currentPhoto.originalname);

    const uniqueFileName = `${v4()}-${fileName}`;

    const { data: fileData, error: errorInsertNewPhoto } = await this.supabase.storage
      .from('condo')
      .upload(`uploads/${uniqueFileName}`, currentPhoto.buffer);

    if (errorInsertNewPhoto) {
      throw new Error(errorInsertNewPhoto.message)
    }
    photoUrl = fileData.fullPath;


    const { error: errorUpdateAsset } = await this.supabase
      .from('assets')
      .update({
        photo_url: photoUrl,
        updated_at: new Date()
      })
      .eq('id', assetId);

    if (errorUpdateAsset) {
      throw new Error(errorUpdateAsset.message)
    }
  }

  async deleteAssetImage(assetId: string) {
    const { data, error } = await this.supabase.from("assets").select('*').eq('id', assetId);

    if (error) {
      throw new Error(error.message)
    }

    const currentAsset = data?.[0];

    if (currentAsset.photo_url) {
      const [_, ...path] = currentAsset.photo_url.split('/');
      const pathFormatted = path.join('/');
      const { error: errorDeleteImage } = await this.supabase.storage
        .from('condo')
        .remove([pathFormatted]);
      if (errorDeleteImage) {
        throw new Error(errorDeleteImage.message)
      }

      await this.supabase.from('assets').update({ photo_url: null }).eq('id', assetId)
    }
  }

  async getNotifications(token: string) {
    const { userId } = await this.authService.decodeToken(token);

    const { data, error } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("to_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(error.message)
    }


    return camelcaseKeys(data)
  }

  async markNotificationAsRead(notificationId) {
    await this.supabase.from("notifications").update({
      read: true
    }).eq('id', notificationId)
  }

  async createReportAsset(
    assetId: string,
    data: any,
    photos: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    }[],
    token: string
  ) {
    const projectUrl = "https://vtupybmxylkunzpgxwex.supabase.co";
    const bucket = "condo";

    const photosObject = await Promise.all(
      photos.map(async (photo) => {
        const fileName = normalizeFileName(photo.originalname);
        const uuid = v4();
        const uniqueFileName = `${uuid}-${fileName}`;

        const { data: fileData, error } = await this.supabase.storage
          .from(bucket)
          .upload(`uploads/${uniqueFileName}`, photo.buffer, {
            contentType: photo.mimetype,
            upsert: false,
          });

        if (error) {
          throw new Error(error.message);
        }

        const { path, id } = fileData;

        // URL permanente do arquivo
        const publicUrl = `${projectUrl}/storage/v1/object/public/${bucket}/${path}`;

        return {
          supabaseId: id,
          path,
          publicUrl, // aqui já fica a URL pronta
          localId: uuid,
        };
      })
    );

    const { userId } = await this.authService.decodeToken(token);
    const {
      condominiumId,
      name
    } = await this.authService.me(userId)

    const { data: reports, error } = await this.supabase.from("asset_reports").insert({
      asset_id: assetId,
      description: data.description,
      reported_by: userId,
      photos: photosObject,
      created_at: new Date(),
    })
      .select('*');


    if (error) {
      throw new Error(error.message);
    }

    const { data: users, error: usersError } = await this.supabase
      .from("user")
      .select(`*, user_association (*)`);


    const usersFiltered =
      users?.filter(user => String(user.user_association?.[0]?.condominium_id) === String(condominiumId) && user.user_association?.[0]?.role === 'admin' || user.user_association?.[0]?.role === 'employee').map(user => user.id)


    await Promise.all((usersFiltered ?? []).map(async (toUserId) => {
      const { error } = await this.supabase.from('notifications').insert({
        title: 'Novo report adicionado a um patrimonio',
        description: `Um report foi adicionado ao patrimonio pelo ${name}`,
        created_at: new Date(),
        created_by: userId,
        read: false,
        condominium_id: condominiumId,
        to_user_id: toUserId
      })

      if (error) {
        console.log("ERROR SENDING NOTIFICATION =>", error)
      }
    }))


  }


  async getAssetWithReports(assetId: string) {
    const { data: assets, error } = await this.supabase
      .from("assets")
      .select(`*, asset_reports (*)`)
      .eq('id', assetId);

    if (error) {
      throw new Error(error.message)
    }

    const assetsFlatten = assets.map(asset => flattenObject(asset));

    const assetsFormatted = camelcaseKeys(assetsFlatten, { deep: true });

    return assetsFormatted
  }

  async getIndicatorsResume(date: string, token: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const year = new Date(date).getFullYear();


    const { data: financialRecords, error: errorFinancialRecords } = await this.supabase
      .from("financial_records")
      .select(`*, categories (*)`)
      .eq("condominium_id", condominiumId)
      .eq('is_deleted', false)
      .gte('due_date', `${year}-01-01`)
      .lte('due_date', `${year}-12-01`)

    const INCOME_EXPENSE_TYPE_ID = 6;

    const amountByMonth = await Promise.all(Array.from({ length: 12 }).map(async (_, index) => {
      const dateFormatted = `${year}-${String(index + 1).padStart(2, '0')}`

      const { data: condominiumFinances,
        error: condiminiumFinancesErrror } = await this.supabase
          .from('condominium_finances')
          .select('*')
          .eq('condominium_id', condominiumId)
          .eq('reference_month', `${dateFormatted}-01`);

      if (condiminiumFinancesErrror) {
        console.log('ERROR : ', condiminiumFinancesErrror.message);
      }

      const currentCondominiumFinances = condominiumFinances?.[0];

      if (currentCondominiumFinances && currentCondominiumFinances.expenses) {
        return currentCondominiumFinances.expenses
      }
      const financialRegisterFormattedByMonth = financialRecords?.filter(financial => {
        const [year, month] = financial.due_date.split('-')
        const dueDateFormattedWithoutDay = `${year}-${month}`

        if (dueDateFormattedWithoutDay === dateFormatted && financial.categories.income_expense_type_id === INCOME_EXPENSE_TYPE_ID) return true
        return false
      })

      const total = financialRegisterFormattedByMonth?.reduce((acc, currentValue) => {
        return acc += currentValue.amount
      }, 0);
      return total

    }))

    const totalExpenses = amountByMonth.reduce((acc, value) => acc += value, 0)
    const startOfYear = format(new Date(year, 0, 1), 'yyyy-MM-dd');
    const endOfYear = format(new Date(year, 11, 31), 'yyyy-MM-dd');

    const { data: maintenances, error: maintenancesError } = await this.supabase
      .from('maintenances')
      .select('*')
      .eq('condominium_id', condominiumId)
      .gte('planned_start', startOfYear)
      .lte('planned_start', endOfYear);

    if (maintenancesError) {
      throw new Error(maintenancesError.message)
    }

    const MAINTENANCE_TYPE_ID = 1;
    const IMPROVEMENT_TYPE_ID = 2;

    const resultSeparated: {
      improvements: any[],
      maintenances: any[]
    } = {
      improvements: [],
      maintenances: [],
    }

    let totalTimeExecutionImprovement = 0;
    let totalImprovementsFinished = 0;

    maintenances.forEach(item => {
      if (item.type_id === MAINTENANCE_TYPE_ID) {
        resultSeparated.maintenances.push(item)
      } else {
        resultSeparated.improvements.push(item);
        const isFinished = !!item.actual_start && !!item.actual_end;
        if (isFinished) {
          const timePast = differenceInMinutes(item.actual_end, item.actual_start);
          totalTimeExecutionImprovement += timePast;
          totalImprovementsFinished += 1;
        }
      }
    })

    let accuracyExecutionDaysImprovements = (totalTimeExecutionImprovement / totalImprovementsFinished) / 1440;
    const improvementsImplemented = resultSeparated.improvements.length;
    const improvementsCost = resultSeparated.improvements.reduce((acc, improvement) => acc += improvement.amount, 0);
    const percentageImpactImprovements = totalExpenses ? ((improvementsCost / totalExpenses) * 100).toFixed(2) : 0
    const accuracyImprovementCost = improvementsCost > 0 ? (improvementsCost / resultSeparated.improvements.length).toFixed(2) : 0
    const maintenancePerfomed = resultSeparated.maintenances.length;
    const maintenanceCost = resultSeparated.maintenances.reduce((acc, maintenance) => acc += maintenance.amount, 0);
    const percentageImpactMaintenances = totalExpenses ? ((maintenanceCost / totalExpenses) * 100).toFixed(2) : 0
    const accuracyMaintenanceCost = maintenanceCost > 0 ? (maintenanceCost / resultSeparated.maintenances.length).toFixed(2) : 0

    return {
      accuracyExecutionDaysImprovements,
      improvementsImplemented,
      improvementsCost,
      accuracyImprovementCost,
      maintenancePerfomed,
      accuracyMaintenanceCost,
      maintenanceCost,
      percentageImpactImprovements,
      percentageImpactMaintenances,
    }
  }

}