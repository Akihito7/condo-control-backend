import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { CreateVisitBody, GetVisitorsParams } from './types/dto/security.dto';
import camelcaseKeys from 'camelcase-keys';
import { flattenObject } from 'src/utils/flatten-object';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class SecurityService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly authService: AuthService,
  ) {}

  async visitorRegistration(data: CreateVisitBody) {
    const { condominiumId, apartamentNumber, visitType, people, vehiclePlate } =
      data;
    const { data: apartaments, error: apartamentsError } = await this.supabase
      .from('apartment')
      .select('*')
      .eq('id', apartamentNumber)
      .eq('condominium_id', condominiumId);

    if (apartamentsError) {
      throw new Error(apartamentsError.message);
    }

    const apartamentSelected = apartaments?.[0];

    if (!apartamentSelected?.id) {
      throw new BadRequestException(
        'Nenhum apartamento com esse numero encontrado.',
      );
    }

    const { data: visits, error: visitsError } = await this.supabase
      .from('visit')
      .insert({
        condominium_id: condominiumId,
        apartament_id: apartamentSelected.id,
        check_in: new Date(),
        visit_type: visitType,
      })
      .select('*');

    if (visitsError) {
      throw new Error(visitsError.message);
    }

    const currentVisit: any = visits?.[0];

    if (!currentVisit) {
      throw new Error('Nenhuma visita encontrada.');
    }

    const promissesVisitPeople = people.map(async (person) => {
      const { data: _, error: personVisitError } = await this.supabase
        .from('person_visit')
        .insert({
          visit_id: currentVisit.id,
          full_name: person.fullName,
          cpf: person.cpf,
          vehicle: vehiclePlate,
        });

      if (personVisitError) {
        throw new Error(personVisitError.message);
      }
    });

    await Promise.all(promissesVisitPeople);
  }

  async getVisitorsByCondominium(filter: GetVisitorsParams) {
    const { condominiumId, startDate, endDate } = filter;
    const startDateWithHours = startDate + ' 00:00:00';
    const endDateWithHours = endDate + ' 23:59:59';
    const { data: visits, error: visitsError } = await this.supabase
      .from('visit')
      .select(
        `*,
        person_visit (*),
        apartment (*)
        `,
      )
      .eq('condominium_id', condominiumId)
      .gte('check_in', startDateWithHours)
      .lte('check_in', endDateWithHours)
      .order('check_in', { ascending: false });

    if (visitsError) {
      throw new Error(visitsError.message);
    }
    const flattenVisits = visits.map((visit) => flattenObject(visit));
    const result = camelcaseKeys(flattenVisits, { deep: true });
    return result;
  }

  async doneCheckoutOut(visitId: string) {
    const { error } = await this.supabase
      .from('visit')
      .update({
        check_out: new Date(),
      })
      .eq('id', visitId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getUnitStatuses() {
    const { data, error } = await this.supabase
      .from('unit_statuses')
      .select('*');

    if (error) throw new Error(error.message);

    return camelcaseKeys(data);
  }

  async createUnit(data: any, token: string) {
    const { userId } = await this.authService.decodeToken(token);

    const { condominiumId } = await this.authService.me(userId);

    const { data: apartaments, error: apartamentsError } = await this.supabase
      .from('apartment')
      .select('*')
      .eq('id', data.apartment_id);

    if (apartamentsError) throw new Error(apartamentsError.message);

    const currentApartament = apartaments?.[0];

    const { data: units, error } = await this.supabase
      .from('units')
      .insert({
        status_id: data.status_id,
        condominium_id: condominiumId,
        apartament_id: currentApartament.id,
        block_id: currentApartament.block_id,
        guest: data.guest,
        contact: data.contact,
        created_at: new Date(),
      })
      .select('*');

    if (error) throw new Error(error.message);

    const currentUnit = units?.[0];

    const responsiblesWithUnitId = data.responsibles.map((responsible) => ({
      unit_id: currentUnit.id,
      ...responsible,
    }));

    const { error: insertUnitResponsiblesError } = await this.supabase
      .from('unit_responsibles')
      .insert(responsiblesWithUnitId);

    if (insertUnitResponsiblesError)
      throw new Error(insertUnitResponsiblesError.message);
  }

  async updateUnit(unitId: string, data: any) {
    const { responsibles, ...rest } = data;

    const { data: apartaments, error: apartamentsError } = await this.supabase
      .from('apartment')
      .select('*')
      .eq('id', data.apartament_id);

    if (apartamentsError) throw new Error(apartamentsError.message);

    const currentApartament = apartaments?.[0];

    console.log(unitId)

    await this.supabase
      .from('units')
      .update({
        apartament_id: currentApartament.id,
        block_id: currentApartament.block_id,
        status_id: rest.status_id,
        guest: rest.guest,
        contact: rest.contact,
      })
      .eq('id', unitId);

    console.log('cheguei aqui', currentApartament);

    const { data: units, error: unitsError } = await this.supabase
      .from('unit_responsibles')
      .select('*')
      .eq('unit_id', unitId);

    if (unitsError) throw new Error(unitsError.message);

    const unitsToUpdate = responsibles.filter(
      (responsible) => responsible.responsibleId,
    );

    const promissesUpdate = unitsToUpdate.map(async (unit) => {
      const responsibleId = unit.responsibleId;

      const { error } = await this.supabase
        .from('unit_responsibles')
        .update({
          name: unit.name,
          creci: unit.creci,
        })
        .eq('id', responsibleId);

      if (error) throw new Error(error.message);
    });

    await Promise.all(promissesUpdate);

    const resposiblesIdsFromRequest = responsibles.map(
      ({ responsibleId }) => responsibleId,
    );

    const unitsToAdd = responsibles
      .filter((responsible) => !responsible.responsibleId)
      .map((unit) => ({
        unit_id: unitId,
        name: unit.name,
        creci: unit.creci,
      }));

    const { error: unitsAddError } = await this.supabase
      .from('unit_responsibles')
      .insert(unitsToAdd);

    if (unitsAddError) throw new Error(unitsAddError.message);

    const unitsToRemove = units.filter(
      (unit) => !resposiblesIdsFromRequest.includes(unit.id),
    );

    const promisesToRemove = unitsToRemove.map(async (unit) => {
      const responsibleId = unit.id;

      const { error } = await this.supabase
        .from('unit_responsibles')
        .delete()
        .eq('id', responsibleId);

      if (error) throw new Error(error.message);
    });

    await Promise.all(promisesToRemove);
  }

  async getUnits(token: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data } = await this.supabase
      .from('units')
      .select('*, unit_responsibles(*)')
      .eq('condominium_id', condominiumId)
      .throwOnError();

    return camelcaseKeys(data);
  }

  async getBlocks(token: string) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);
    const { data } = await this.supabase
      .from('block')
      .select('*')
      .eq('condominium_id', condominiumId);

    return camelcaseKeys(data ?? []);
  }
}
