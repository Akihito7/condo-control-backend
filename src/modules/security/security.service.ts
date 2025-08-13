import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { CreateVisitBody, GetVisitorsParams } from "./types/dto/security.dto";
import camelcaseKeys from "camelcase-keys";
import { flattenObject } from "src/utils/flatten-object";

@Injectable()
export class SecurityService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) { }

  async visitorRegistration(data: CreateVisitBody) {
    const {
      condominiumId,
      apartamentNumber,
      visitType,
      people,
      vehiclePlate,
    } = data;
    const { data: apartaments, error: apartamentsError } = await this.supabase
      .from('apartment')
      .select("*")
      .eq('apartment_number', apartamentNumber)
      .eq('condominium_id', condominiumId)

    if (apartamentsError) {
      throw new Error(apartamentsError.message)
    }

    const apartamentSelected = apartaments?.[0];

    if (!apartamentSelected?.id) {
      throw new BadRequestException('Nenhum apartamento com esse numero encontrado.')
    }

    const { data: visits, error: visitsError } = await this.supabase.from('visit').insert({
      condominium_id: condominiumId,
      apartament_id: apartamentSelected.id,
      check_in: new Date(),
      visit_type: visitType
    }).select('*')

    if (visitsError) {
      throw new Error(visitsError.message)
    }

    const currentVisit: any = visits?.[0];

    if (!currentVisit) {
      throw new Error('Nenhuma visita encontrada.')
    }

    const promissesVisitPeople = people.map(async person => {
      const { data: _, error: personVisitError } = await this.supabase.from('person_visit').insert({
        visit_id: currentVisit.id,
        full_name: person.fullName,
        cpf: person.cpf,
        vehicle: vehiclePlate
      })

      if (personVisitError) {
        throw new Error(personVisitError.message)
      }
    })

    await Promise.all(promissesVisitPeople)
  }

  async getVisitorsByCondominium(filter: GetVisitorsParams) {
    const { condominiumId, startDate, endDate } = filter;
    const startDateWithHours = startDate + ' 00:00:00'
    const endDateWithHours = endDate + ' 23:59:59';
    const { data: visits, error: visitsError } = await this.supabase.from('visit')
      .select(`*,
        person_visit (*),
        apartment (*)
        `)
      .eq('condominium_id', condominiumId)
      .gte('check_in', startDateWithHours)
      .lte('check_in', endDateWithHours)
      .order('check_in', { ascending: false });

    if (visitsError) {
      throw new Error(visitsError.message)
    }
    const flattenVisits = visits.map(visit => flattenObject(visit));
    const result = camelcaseKeys(flattenVisits, { deep: true });
    return result

  }

  async doneCheckoutOut(visitId: string) {
    const { error } = await this.supabase.from("visit")
      .update({
        'check_out': new Date()
      })
      .eq('id', visitId);

    if (error) {
      throw new Error(error.message)
    }
  }
}