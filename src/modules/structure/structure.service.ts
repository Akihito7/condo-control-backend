import { Body, Inject, Injectable, Param, Post } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { AuthService } from "../auth/auth.service";
import * as bcrypt from "bcrypt"
import camelcaseKeys from "camelcase-keys";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, compareAsc, differenceInMinutes, addMonths, differenceInYears, startOfYear, endOfYear } from 'date-fns';
import { bn, id, ptBR } from 'date-fns/locale';
import { getFullMonthInterval } from "src/utils/get-full-month-interval";
import { flattenObject } from "src/utils/flatten-object";
import { FinanceService } from "../finance/finance.service";
import { BodyAsset, CreateEmployeeBody, CreateMaintenanceManagementAssetDTO, EventSpace, InterventionBody, InterventionPayment, UpdateEmployeeScheduleBody } from "./types/dto/structure.dto";
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
      .select(`*, space_event_guests (*), space_events_relation_area_availability (*), condominium_areas (*)`)
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

    for (let event of events) {
      const areaAvailabilityIdSelecteds = event.spaceEventsRelationAreaAvailability.map(option => option.areaAvailabilityId);
      const eventFormatted = {
        ...event,
        areaAvailabilityIdSelecteds
      }
      const eventDay = daysWithEvents.find(day => day.date === event.eventDate);
      if (eventDay) {
        eventDay.events.push(eventFormatted as never);
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

    const { data: spaceEvents, error: spaceEventsError } = await this.supabase.from('space_events')
      .select(`*, space_events_relation_area_availability (*)`)
      .eq('id', eventId)

    if (spaceEventsError) throw new Error(spaceEventsError.message);

    const spacesEventsCamelcase = camelcaseKeys(spaceEvents);

    const periodsAlreadySelected = spacesEventsCamelcase?.[0]
      .spaceEventsRelationAreaAvailability
      .map(item => String(item.area_availability_id));

    const periodsToRemove = periodsAlreadySelected.filter(periodSelected => !data.periodSelectedIds.includes(periodSelected));
    const periodsToAdd = data.periodSelectedIds.filter(periodId => !periodsAlreadySelected.includes(periodId));

    await Promise.all(periodsToRemove.map(async periodToRemoveId => {
      await this.supabase.from('space_events_relation_area_availability')
        .delete()
        .eq('area_availability_id', periodToRemoveId)
        .eq('event_id', eventId)
    }))

    await Promise.all(periodsToAdd.map(async (periodToAdd) => {
      await this.supabase
        .from('space_events_relation_area_availability')
        .insert({
          event_id: eventId,
          area_availability_id: periodToAdd
        })
    }))

    const { data: periods, error: periodsError } = await this.supabase
      .from('area_availability')
      .select('*')
      .in('id', data.periodSelectedIds);

    if (periodsError) throw new Error(periodsError.message);

    periods.sort((a, b) => a.start_hour.localeCompare(b.start_hour));

    const startTime = periods[0].start_hour;
    const endTime = periods[periods.length - 1].end_hour;

    const { error } = await this.supabase.from("space_events")
      .update({
        start_time: startTime,
        end_time: endTime
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
    await this.supabase.from('space_events_relation_area_availability').delete().eq('event_id', eventId)
    await this.supabase.from("space_event_guests").delete().eq("space_event_id", eventId);
    await this.supabase.from('space_events').delete().eq('id', eventId)
  }

  async createEventSpace(data: {
    condominiumAreaId: string
    apartmentId: string
    periodSelecteds: string[]
    eventDate: string;
    guests: { name: string, cpf: string }[]
  }) {

    const hoursSelectedResult = await Promise.all(data.periodSelecteds.map(async (periodId) => {
      const { data } = await this.supabase
        .from('area_availability')
        .select("*")
        .eq('id', periodId);

      return data?.[0];
    }))

    hoursSelectedResult.sort((a, b) => a.start_hour.localeCompare(b.start_hour));

    const startTime = hoursSelectedResult[0].start_hour;
    const endTime = hoursSelectedResult[hoursSelectedResult.length - 1].end_hour;

    if (data.periodSelecteds.length === 0) throw new Error('Voce nao pode criar um evento sem horario');

    const { data: eventsInserted, error } = await this.supabase.from('space_events').insert({
      event_date: data.eventDate,
      condominium_area_id: data.condominiumAreaId,
      apartment_id: data.apartmentId,
      start_time: startTime,
      end_time: endTime,
    })
      .select('id');

    if (error) throw new Error(error.message);

    const currentEventInserted = eventsInserted?.[0];

    const periodsToInsert = data.periodSelecteds.map(periodId => ({
      event_id: currentEventInserted.id,
      area_availability_id: periodId
    }))

    const { error: insertPeriodError } = await this.supabase
      .from('space_events_relation_area_availability')
      .insert(periodsToInsert)

    if (insertPeriodError) throw new Error(insertPeriodError.message);

    const guestsToInsert = data.guests.map(guest => ({
      name: guest.name,
      cpf: guest.cpf,
      space_event_id: currentEventInserted.id,
      created_at: new Date()
    }));

    const { error: errorInsertGuests } = await this.supabase
      .from('space_event_guests')
      .insert(guestsToInsert);

    if (errorInsertGuests) throw new Error(errorInsertGuests.message)

  }

  async getMaintenances(date: string, token: string) {
    const { userId } = await this.authService.decodeToken(token);
    const userInfo = await this.authService.me(userId);

    const year = new Date(date).getFullYear();
    const startOfYear = format(new Date(year, 0, 1), 'yyyy-MM-dd')
    const endOfYear = format(new Date(year, 11, 31), 'yyyy-MM-dd')

    const condominiumId = userInfo.condominiumId;
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
      .eq('condominium_id', condominiumId)
      .eq('type_id', 2)

    if (maintenancesError) {
      throw new Error(maintenancesError.message);
    }
    const filteredMaintenances = maintenances.filter(maintenance => {
      const quantityPayments = maintenance.maintenance_payments.length;

      if (quantityPayments === 0) return true

      return maintenance.maintenance_payments.some(payment => {
        const paymentDate = new Date(payment.payment_date);
        return paymentDate >= new Date(startOfYear) && paymentDate <= new Date(endOfYear);
      })
    }
    );
    const maintenancesFormatted: any[] = camelcaseKeys(filteredMaintenances.map(maintenance => flattenObject(maintenance)));

    return maintenancesFormatted;
  }


  async createMaintenance(condominiumId: string, token: string, data: InterventionBody, attachments?: any[]) {
    const { userId } = await this.authService.decodeToken(token);

    const hasNextMaintenance = !!data.nextMaintenance;

    const paymentMethodFormatted = data.paymentMethod ? data.paymentMethod : null;

    const registersToCreate = [{
      priority_id: data.priority,
      type_id: data.type,
      description: data.description,
      supplier: data.provider,
      amount: data.value ? Number(data.value) : 0,
      payment_method: paymentMethodFormatted,
      payment_date: data.paymentDate,
      payment_completion_date: data.paymentCompletionDate,
      condominium_area_id: data.area,
      status_id: data.status,
      created_at: new Date(),
      created_by_id: userId,
      condominium_id: condominiumId,
      planned_start: data.plannedStart,
      planned_end: data.plannedEnd,
      actual_start: data.actualStart,
      actual_end: data.actualEnd,
      number_of_installments: data.numberOfInstallments,
      is_installment: data.isInstallment,
      contact: data.contact,
      type_maintenance: data.typeMaintenance,
      asset_maintenance_id: data.assetType
    }]

    /*     if (hasNextMaintenance) {
          registersToCreate.push({
            priority_id: data.priority,
            type_id: data.type,
            description: data.description,
            supplier: data.provider,
            amount: data.value ? Number(data.value) : 0,
            payment_method: paymentMethodFormatted,
            payment_date: data.paymentDate,
            payment_completion_date: data.paymentCompletionDate,
            condominium_area_id: data.area,
            status_id: '3',
            created_at: new Date(),
            created_by_id: userId,
            condominium_id: condominiumId,
            planned_start: data.nextMaintenance,
            planned_end: data.plannedEnd,
            actual_start: data.actualStart,
            actual_end: data.actualEnd,
            number_of_installments: data.numberOfInstallments,
            is_installment: data.isInstallment,
            contact: data.contact,
            type_maintenance: data.typeMaintenance,
            asset_maintenance_id: data.assetType
          })
        }
     */
    const { data: insertedMaintenances, error } = await this.supabase
      .from('maintenances')
      .insert(registersToCreate)
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
        const paymentDate = addMonths(initialDate, i)

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

    const promisesDocuments = attachments?.map(async document => {
      const fileName = normalizeFileName(document.originalname);
      const uniqueFileName = `${v4()}-${fileName}`;
      const { data: fileData, error } = await this.supabase.storage
        .from('condo')
        .upload(`uploads/${uniqueFileName}`, document.buffer);

      if (error) throw new Error(error.message);

      const { id, fullPath } = fileData;

      const { data: attachamentsInserted, error: insertFileError } = await this.supabase
        .from('attachments')
        .insert({
          related_type: 'maintenances',
          related_id: maintenanceId,
          condominium_id: condominiumId,
          date: format(new Date(), 'yyyy-MM-dd'),
          path: fullPath,
          bucket_name: 'condo',
          original_name: fileName,
          screen_origin: 'maintenance-management',
          created_at: new Date(),
          supabase_id: id,
        })
        .select('*')
    })

    await Promise.all(promisesDocuments ?? [])
    return { maintenanceId };
  }


  async updateMaintenance(token: string, data: any, maintenanceId: string) {

    const { userId } = await this.authService.decodeToken(token);

    const userInfo = await this.authService.me(userId);

    const condominiumId = userInfo.condominiumId;

    const { data: maintenances, error: maintenancesError } = await this.supabase
      .from('maintenances')
      .select('*')
      .eq('id', maintenanceId);

    if (maintenancesError) throw new Error(maintenancesError.message);

    const { error } = await this.supabase
      .from('maintenances')
      .update({
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
        actual_start: data.actualStart,
        actual_end: data.actualEnd,
        is_installment: data.isInstallment
      })
      .eq('id', maintenanceId);


    const currentMaintenance = maintenances?.[0];

    const alreadyHasNextMaintenance = currentMaintenance.next_maintenance;
    const isMaintenance = Number(data.type) === 1;
    const isPreventiveMaintenance = Number(data.typeMaintenance) === 1;
    const currentHasNextMaintenace = data.nextMaintenance;

    if (!alreadyHasNextMaintenance) {
      if (isMaintenance && isPreventiveMaintenance && Number(data.status) === 5) {
        const objectToCreate = currentMaintenance;
        delete objectToCreate.id;
        const { data: nextMaintenances, error } = await this.supabase
          .from("maintenances")
          .insert({
            ...objectToCreate,
            status_id: 3,
            planned_start: currentHasNextMaintenace,
          })
          .select('*')

        const currentNextMaintenanceId = nextMaintenances?.[0]?.id

        await this.supabase
          .from('maintenances')
          .update({
            next_maintenance: currentNextMaintenanceId
          })
          .eq('id', maintenanceId)
      }

    }

    const alreadyInstallment = currentMaintenance.is_installment;

    const keepInstallment = alreadyInstallment && data.isInstallment;

    const isInstallment = data.isInstallment;

    await this.supabase.from('maintenance_payments')
      .delete()
      .eq('maintenance_id', maintenanceId);

    const { error: maintenanceErrorUpate } = await this.supabase
      .from('maintenances')
      .update({
        is_installment: false,
        number_of_installments: null
      })
      .eq('id', maintenanceId)

    if (maintenanceErrorUpate) throw new Error(maintenanceErrorUpate.message)

    if (keepInstallment || isInstallment) {
      if (data.paymentDate && data.value) {

        await this.supabase.from('maintenances').update({
          is_installment: true,
          number_of_installments: data.numberOfInstallments ?? 1
        })
          .eq('id', maintenanceId)
        const paymentsToInsert: any[] = [];

        const initialDate = new Date(data.paymentDate);
        const numberOfInstallments = data.numberOfInstallments ?? 1

        const installmentValue = Number(data.value) / numberOfInstallments;

        for (let i = 0; i < numberOfInstallments; i++) {
          const paymentDate = addMonths(initialDate, i)

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
    }


    if (!isInstallment && !keepInstallment && data.paymentDate && data.value) {

      await this.supabase.from('maintenances').update({
        is_installment: false,
        number_of_installments: null
      })
        .eq('id', maintenanceId);

      const paymentDate = new Date(data.paymentDate);
      const { error: paymentsError } = await this.supabase
        .from('maintenance_payments')
        .insert({
          maintenance_id: maintenanceId,
          payment_date: paymentDate.toISOString(),
          amount: Number(data.value),
          is_installment: data.isInstallment,
          created_at: new Date(),
          updated_at: new Date(),
        });
    }


  }

  async deleteMaintenance(maintenanceId: string) {

    const { data: maintenances } = await this.supabase
      .from('maintenances')
      .select('*')
      .eq('next_maintenance', maintenanceId);

    console.log(maintenances)
    const maintenancesIdToRemoveNextMaintenance = maintenances?.map((maintenance) => maintenance.id) as Number[];


    await this.supabase.from('maintenances').update({
      next_maintenance: null
    })
      .in('id', maintenancesIdToRemoveNextMaintenance)

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

    const UNDER_ANALYSIS = 3;
    const CANCELED = 4;
    const statusExcluded = [CANCELED, UNDER_ANALYSIS]

    const maintenancePaymentsFormatted =
      camelcaseKeys(maintenancesPaymentsFilteredByCondominium.map(maintenance => flattenObject(maintenance))) as InterventionPayment[]

    const monthCurrentDate = startDate.slice(0, 7)

    const newMonthlyFixedCosts = maintenancePaymentsFormatted.reduce((total, intervention) => {
      const paymentDate = intervention.paymentDate.slice(0, 7)
      const monthIsMatch = paymentDate === monthCurrentDate
      const shouldCount =
        monthIsMatch && intervention.isInstallment && !statusExcluded.includes(intervention.maintenancesStatusId)

      return total + (shouldCount ? intervention.amount : 0)
    }, 0)

    const registersFiltered = maintenancePaymentsFormatted.filter(register => !statusExcluded.includes(register.maintenancesStatusId))
    const uniqueRegistersId = new Set(registersFiltered.map(register => register.maintenanceId))
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

      const hasReportNotFinished = asset.asset_reports.some(report => report.status != 'finalizado');

      return {
        ...asset,
        reportCount: asset.asset_reports.length,
        publicUrl: publicUrlAsset,
        hasReportNotFinished
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


  async getChartImprovementsByArea({ date, token }: { date: string, token: string }) {
    const IMPROVEMENT_TYPE_ID = 2;
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const year = new Date(date).getFullYear();

    const { data, error } = await this.supabase.from('maintenances')
      .select("*, condominium_areas (*)")
      .eq('condominium_id', condominiumId)
      .eq('type_id', IMPROVEMENT_TYPE_ID)
      .gte('planned_start', `${year}-01-01`)
      .lte('planned_start', `${year}-12-01`)


    if (error) {
      throw new Error(error.message)
    }

    const result = data.reduce((result, current) => {
      const hasAreaToCurrentImprovement = result.findIndex(item => item.areaId === current.condominium_areas.id);
      if (hasAreaToCurrentImprovement === -1) {
        const newObject = {
          areaId: current.condominium_areas.id,
          areaName: current.condominium_areas.name,
          count: 1
        }
        return result = [...result, newObject]
      }
      const resultCurrentItem = result[hasAreaToCurrentImprovement]
      resultCurrentItem.count += 1
      return result;
    }, []);

    return result.sort((a, b) => b.count - a.count)
  }

  async getChartMonthlyExpensesSummary({ date, token }: { date: string, token: string }) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const year = new Date(date).getFullYear();


    const arrayMonths = Array.from({ length: 12 });
    const MONTHS_LABEL = [
      `jan/${year}`,
      `fev/${year}`,
      `mar/${year}`,
      `abr/${year}`,
      `mai/${year}`,
      `jun/${year}`,
      `jul/${year}`,
      `ago/${year}`,
      `set/${year}`,
      `out/${year}`,
      `nov/${year}`,
      `dez/${year}`,
    ];

    const formatterDate = (month: number) => {
      const monthFormatted = String(month).padStart(2, '0');
      const dateFormatted = new Date(`${year}/${monthFormatted}/01`).toISOString()
      return dateFormatted
    }
    const result = await Promise.all(arrayMonths.map(async (_, index) => {
      const dateFormatted = formatterDate(index + 1);
      const {
        startDate,
        endDate
      } = getFullMonthInterval(dateFormatted);

      const { data: maintenances, error: maintenancesError } = await this.supabase
        .from('maintenances')
        .select('*')
        .eq('condominium_id', condominiumId)
        .gte('planned_start', startDate)
        .lte('planned_start', endDate);

      if (maintenancesError) {
        console.log(maintenancesError.message);
      }

      const totalCoustMaintenances = maintenances?.reduce((acc, maintenance) => acc += maintenance.amount, 0);
      const nameMonth = MONTHS_LABEL[index];

      return {
        id: index,
        nameMonth,
        totalCoustMaintenances,
        accumulatedBalance: totalCoustMaintenances
      }
    }))

    let left = 0;
    let right = 1;


    while (right < result.length) {
      const totalCoustAccumulated = result[left].accumulatedBalance + result[right].totalCoustMaintenances;
      result[right].accumulatedBalance = totalCoustAccumulated
      left += 1;
      right += 1;
    }
    return result;
  }

  async updateDetailsReportAsset(reportId: string, body: any) {
    const { error } = await this.supabase
      .from('asset_reports')
      .update({
        status: body.status
      })
      .eq('id', reportId);

    if (error) {
      throw new Error(error.message)
    }
  }

  async getAreaAvailabilityOptions({ areaId }: { areaId: string }) {
    const { data: areasOptions, error } = await this.supabase
      .from('area_availability')
      .select('*')
      .eq('condominium_area_id', areaId);

    if (error) throw new Error(error.message)

    return camelcaseKeys(areasOptions, { deep: true });
  }

  async getManagementSpacesIndicatorsCards({ date, token }: { date: string, token: string }) {
    const {
      startDate,
      endDate
    } = getFullMonthInterval(date);

    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data: events, error: eventsError } = await this.supabase
      .from('space_events')
      .select(`*, space_events_relation_area_availability (*), condominium_areas (*)`)
      .gte('event_date', startDate)
      .lte('event_date', endDate);

    if (eventsError) throw new Error(eventsError.message);

    const eventsCamelcase = camelcaseKeys(events, { deep: true })

    const { data: totalAvailableTimesMonth } = await this.supabase.rpc("get_total_area_availability", {
      p_date: startDate,
      p_condominium_id: condominiumId
    })

    const totalBookingsMonth = eventsCamelcase.reduce((acc, event) => acc += event.spaceEventsRelationAreaAvailability.length, 0);
    const totalOccupationMonth = ((totalBookingsMonth / totalAvailableTimesMonth) * 100).toFixed(2)
    const totalRevenueMOnth = eventsCamelcase.reduce((acc, event) => {
      const total = event.condominiumAreas.hourlyRent * event.spaceEventsRelationAreaAvailability.length;
      return acc += total
    }, 0);

    return {
      totalBookingsMonth,
      totalOccupationMonth,
      totalRevenueMOnth
    }
  }

  async getManagementBookingsByAreas({ date, token }: { date: string, token: string }) {
    const { startDate, endDate } = getFullMonthInterval(date);

    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);


    const { data, error } = await this.supabase.rpc('get_area_event_count', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_condominium_id: condominiumId
    })

    if (error) throw new Error(error.message);

    return camelcaseKeys(data);
  }

  async getManagementPercentageByArea({ date, token }: { date: string, token: string }) {
    const { startDate, endDate } = getFullMonthInterval(date);

    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data, error } = await this.supabase
      .rpc('get_area_event_indicators_percentage', {
        p_condominium_id: condominiumId,
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (error) throw new Error(error.message);

    return camelcaseKeys(data);
  }

  async getMonthlyRevenueAndOccupation({ token, date }: { token: string, date: string }) {

    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    const [year] = date.split('-')

    const startDate = `${year}/01/01`
    const endDate = `${year}/12/31`
    const allMonthsIndex = Array.from({ length: 12 });

    const { data: eventsData, error: errorEvents } = await this.supabase.from("space_events")
      .select(`
        *, 
        condominium_areas (*),
        space_events_relation_area_availability (*)
        `)
      .gte('event_date', startDate)
      .lte('event_date', endDate)

    if (errorEvents) throw new Error(errorEvents.message);

    const eventsCamelcase = camelcaseKeys(eventsData, { deep: true })


    const dataFormatted = await Promise.all(allMonthsIndex.map(async (_, index) => {
      const date = new Date(`${year}/${String(index + 1).padStart(2, '0')}/01`);
      const { startDate } = getFullMonthInterval(date.toISOString());

      const eventsFilteredByCurrentMonth = eventsCamelcase.filter(event => {
        const [year, month] = event.eventDate.split('-')
        const dateEventFormatted = `${year}-${month}-01`
        const isSameMonth = dateEventFormatted === startDate
        return isSameMonth
      });

      const { data: totalAvailableTimesMonth } = await this.supabase.rpc("get_total_area_availability", {
        p_date: startDate,
        p_condominium_id: condominiumId
      })

      const totalPeriods = eventsFilteredByCurrentMonth.reduce((acc, event) => acc += event.spaceEventsRelationAreaAvailability.length, 0);
      const totalRevenue = eventsFilteredByCurrentMonth.reduce((acc, event) => {
        const { hourlyRent } = event.condominiumAreas;
        const totalPeriodCurrentEvent = event.spaceEventsRelationAreaAvailability.length;
        const totalAmount = hourlyRent * totalPeriodCurrentEvent;
        return acc += totalAmount
      }, 0)
      const totalOccupation = ((totalPeriods / totalAvailableTimesMonth) * 100).toFixed(2);

      return {
        monthName: months[index],
        totalRevenue,
        totalOccupation
      }
    }))

    return dataFormatted;
  }

  async createMaintenanceManagementAssetsType({ token, data }: { token: string, data: { name: string } }) {
    const { userId } = await this.authService.decodeToken(token);
    const {
      condominiumId
    } = await this.authService.me(userId);

    if (!condominiumId) {
      throw new Error('Nenhum condominio encontrado para esse usuario.')
    }

    const {
      name
    } = data;

    const { data: types, error } = await this.supabase
      .from('assets_maintenance_types')
      .insert({
        condominium_id: condominiumId,
        name
      })
      .select('*')

    if (error) throw new Error("Erro ao cadastrar tipo.");

    return camelcaseKeys(types?.[0]);
  }

  async getMaintenanceManagementAssetsTypes(token: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data, error } = await this.supabase
      .from('assets_maintenance_types')
      .select('*')
      .eq('condominium_id', condominiumId);

    if (error) throw new Error(error.message);

    return camelcaseKeys(data, { deep: true })
  }

  async createMaintenanceManagementAsset
    ({ token, data, attachments }: { token: string, data: CreateMaintenanceManagementAssetDTO, attachments: any[] }) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { name, code, frequency, installationDate, lifespan, supplier, type, contact } = data;

    const estimatedUsefulLife = `${lifespan} year`

    const { data: assets, error } = await this.supabase
      .from('assets_maintenance')
      .insert({
        condominium_id: condominiumId,
        name,
        type,
        contact,
        supplier,
        installation_date: new Date(installationDate).toISOString(),
        estimated_useful_life: estimatedUsefulLife,
        maintenance_frequency: frequency,
        code
      })
      .select('*')

    if (error) throw new Error(error.message);

    const currentAsset = assets?.[0];

    const promisesDocuments = attachments.map(async document => {
      const fileName = normalizeFileName(document.originalname);
      const uniqueFileName = `${v4()}-${fileName}`;
      const { data: fileData, error } = await this.supabase.storage
        .from('condo')
        .upload(`uploads/${uniqueFileName}`, document.buffer);

      if (error) throw new Error(error.message);

      const { id, fullPath } = fileData;

      const { data: attachamentsInserted, error: insertFileError } = await this.supabase
        .from('attachments')
        .insert({
          related_type: 'maintenance-management-asset',
          related_id: currentAsset?.id,
          condominium_id: condominiumId,
          date: format(new Date(), 'yyyy-MM-dd'),
          path: fullPath,
          bucket_name: 'condo',
          original_name: fileName,
          screen_origin: 'maintenance-management',
          created_at: new Date(),
          supabase_id: id,
        })
        .select('*')
    })

    await Promise.all(promisesDocuments)
  }

  async getMaintenanceManagementAssets(token: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data, error } = await this.supabase
      .from('assets_maintenance')
      .select('*')
      .eq('condominium_id', condominiumId)
      .eq('is_deleted', false)

    if (error) throw new Error(error.message);

    const dataFormatted = data?.map(asset => {

      const installationDate = new Date(asset.installation_date)

      const differenceInYearsNumber = differenceInYears(new Date, installationDate);

      const estimatedUsefulLife = Number(asset.estimated_useful_life?.split(' ')?.[0]);

      const remainingUsefulLifeNumber = estimatedUsefulLife - differenceInYearsNumber

      const remainingUsefulLife = remainingUsefulLifeNumber > 1 ? `${remainingUsefulLifeNumber} anos` : `${remainingUsefulLifeNumber} ano`

      return {
        ...asset,
        remainingUsefulLife
      }
    })

    return camelcaseKeys(dataFormatted, { deep: true })
  }

  async getMaintenancesManagement(token: string, date: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);
    const {
      startDate,
      endDate
    } = getFullMonthInterval(date);

    const { data, error } = await this.supabase
      .from("maintenances")
      .select(`
        *,
        assets_maintenance (*)
        `)
      .eq('condominium_id', condominiumId)
      .eq('type_id', 1)
      .not('asset_maintenance_id', 'is', null)
      .gte('planned_start', startDate)
      .lte('planned_start', endDate)

    if (error) throw new Error(error.message);

    return camelcaseKeys(data.map(maintenance => flattenObject(maintenance)));
  }

  async getCalendarMaintenances(token: string, date: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const {
      startDate,
      endDate
    } = getFullMonthInterval(date);

    const { data, error } = await this.supabase
      .from("maintenances")
      .select(`
        *,
        assets_maintenance (*)
        `)
      .eq('condominium_id', condominiumId)
      .eq('type_id', 1)
      .not('asset_maintenance_id', 'is', null)
      .gte('planned_start', startDate)
      .lte('planned_start', endDate)

    if (error) throw new Error(error.message);

    const maintenanceEvents: { date: string; dayName: string; dayEvents: any[]; }[] = [];

    const [year, month, day] = endDate.split('-');

    for (let index = 0; index < Number(day); index++) {
      const currentDate = `${year}/${month}/${String(index + 1).padStart(2, '0')}`

      const eventsForCurrentDate = data.filter(maintenance => {
        const plannedStart = maintenance.planned_start;
        if (!plannedStart) return false;
        const plannedStartFormatted = format(plannedStart, 'yyyy/MM/dd');
        return plannedStartFormatted === currentDate;
      });

      const dayName = format(new Date(currentDate), 'EEEE', { locale: ptBR })

      const dayEventDetails = {
        date: currentDate,
        dayName,
        dayEvents: camelcaseKeys(eventsForCurrentDate, { deep: true })
      };

      maintenanceEvents.push(dayEventDetails);
    }

    return maintenanceEvents;
  }

  async getMaintenanceManagementAssetsAttachments(assetId: string) {
    const { data, error } = await this.supabase.from('attachments')
      .select('*')
      .eq('related_type', 'maintenance-management-asset')
      .eq('related_id', assetId);
    if (error) throw new Error(error.message);
    return camelcaseKeys(data, { deep: true })
  }

  async getMaintenanceManagementAttachments(maintenanceId: string) {
    const { data, error } = await this.supabase.from('attachments')
      .select('*')
      .eq('related_type', 'maintenances')
      .eq('related_id', maintenanceId);

    if (error) throw new Error(error.message);
    return camelcaseKeys(data, { deep: true })
  }

  async deleteMaintenanceManagementAssetsAttachments(attchamentId: string) {
    const { error } = await this.supabase
      .from('attachments')
      .delete()
      .eq('id', attchamentId)

    if (error) throw new Error(error.message)
  }

  async deleteMaintenanceManagementAttachments(attchamentId: string) {
    const { error } = await this.supabase
      .from('attachments')
      .delete()
      .eq('id', attchamentId)

    if (error) throw new Error(error.message)
  }

  async addMaintenanceManagementAssetsAttachments(attachments, data) {
    const { maintenanceAssetId, condominiumId } = data;
    console.log(data)

    const newAttachamnets = await Promise.all(attachments.map(async attachment => {
      const fileName = normalizeFileName(attachment.originalname);
      const uniqueFileName = `${v4()}-${fileName}`;
      const { data: fileData, error } = await this.supabase.storage
        .from('condo')
        .upload(`uploads/${uniqueFileName}`, attachment.buffer);

      if (error) console.log('FINANCE UPLOAD FILES ERROR : ', error.message);

      const { data: attachamentsInserted, error: insertFileError } = await this.supabase.from('attachments').insert({
        related_type: 'maintenance-management-asset',
        related_id: maintenanceAssetId,
        condominium_id: condominiumId,
        date: format(new Date(), 'yyyy-MM-dd'),
        path: fileData?.fullPath,
        bucket_name: 'condo',
        original_name: attachment.originalname,
        screen_origin: 'maintenance-management-asset',
        created_at: new Date(),
        supabase_id: fileData?.id,
      })
        .select('*')

      if (insertFileError) console.log(insertFileError.message)

      return attachamentsInserted?.[0]
    }))

    return camelcaseKeys(newAttachamnets, { deep: true });
  }

  async addMaintenanceManagementAttachments(attachments, data) {
    const { maintenanceId, condominiumId } = data;

    const newAttachamnets = await Promise.all(attachments.map(async attachment => {
      const fileName = normalizeFileName(attachment.originalname);
      const uniqueFileName = `${v4()}-${fileName}`;
      const { data: fileData, error } = await this.supabase.storage
        .from('condo')
        .upload(`uploads/${uniqueFileName}`, attachment.buffer);

      if (error) console.log('FINANCE UPLOAD FILES ERROR : ', error.message);

      const { data: attachamentsInserted, error: insertFileError } = await this.supabase
        .from('attachments')
        .insert({
          related_type: 'maintenances',
          related_id: maintenanceId,
          condominium_id: condominiumId,
          date: format(new Date(), 'yyyy-MM-dd'),
          path: fileData?.fullPath,
          bucket_name: 'condo',
          original_name: attachment.originalname,
          screen_origin: 'maintenance-management',
          created_at: new Date(),
          supabase_id: fileData?.id,
        })
        .select('*')

      if (insertFileError) console.log(insertFileError.message)

      return attachamentsInserted?.[0]
    }))

    return camelcaseKeys(newAttachamnets, { deep: true });
  }


  async deleteMaintenanceManagementAssets(assetId: string) {
    await this.supabase
      .from('assets_maintenance')
      .update({
        is_deleted: true
      })
      .eq('id', assetId)
  }

  async getMaintenancesSummary(token: string, year: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const numericYear = Number(year);
    const startDate = startOfYear(new Date(numericYear, 0, 1));
    const endDate = endOfYear(new Date(numericYear, 0, 1));

    const { data: maintenances, error: maintenanacesError } = await this.supabase
      .from('maintenances')
      .select('*, assets_maintenance (*)')
      .eq('condominium_id', condominiumId)
      .gte('planned_start', startDate.toISOString())
      .lte('planned_start', endDate.toISOString())
      .eq('type_id', 1)

    if (maintenanacesError) throw new Error(maintenanacesError.message);

    return this.buildMaintenancesDashboardData(maintenances)
  }



  buildMaintenancesDashboardData(maintenances: any[]) {
    if (!maintenances?.length) {
      return {
        cards: {
          total: 0,
          preventives: 0,
          correctives: 0,
          totalAmount: 0,
          averageAmount: 0,
        },
        charts: {
          monthlyCosts: [],
          maintenanceTypes: [],
          topAssets: [],
        },
      };
    }

    const preventives = maintenances.filter((m) => m.type_maintenance === "1");
    const correctives = maintenances.filter((m) => m.type_maintenance === "2");

    const total = maintenances.length;
    const totalAmount = maintenances.reduce((sum, m) => sum + (m.amount || 0), 0);
    const averageAmount = total ? totalAmount / total : 0;

    // 📊 Agrupar custo mensal (por planned_start)
    const monthlyMap: Record<string, number> = {};
    for (const m of maintenances) {
      if (!m.planned_start) continue;
      const month = format(new Date(m.planned_start), "MMM");
      monthlyMap[month] = (monthlyMap[month] || 0) + (m.amount || 0);
    }

    const monthlyCosts = Object.entries(monthlyMap).map(([month, amount]) => ({
      month,
      amount,
    }));

    // 🧩 Gráfico de preventivas vs corretivas
    const maintenanceTypes = [
      { type: "Preventiva", count: preventives.length },
      { type: "Corretiva", count: correctives.length },
    ];

    // 🏭 Gráfico de ativos com mais manutenções
    const assetCountMap: Record<string, { name: string; count: number }> = {};

    for (const m of maintenances) {
      const asset = m.assets_maintenance;
      if (!asset) continue;

      const assetName = asset.name || "Desconhecido";
      if (!assetCountMap[assetName]) {
        assetCountMap[assetName] = { name: assetName, count: 0 };
      }
      assetCountMap[assetName].count++;
    }

    const topAssets = Object.values(assetCountMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 ativos

    return {
      cards: {
        total,
        preventives: preventives.length,
        correctives: correctives.length,
        totalAmount,
        averageAmount,
      },
      charts: {
        monthlyCosts,
        maintenanceTypes,
        topAssets,
      },
    };
  }
}
