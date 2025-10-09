import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import * as bcrypt from "bcrypt";
import { CreateCondominiumDTO, CreatePlanDTO, CreateTenantDTO, CreateUserDTO } from "./types/dto/backoffice.dto";
import camelcaseKeys from "camelcase-keys";
import { flattenObject } from "src/utils/flatten-object";


@Injectable()
export class BackofficeService {

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) { }

  async createUser({
    condominiumId,
    apartamentId,
    role,
    name,
    email,
    password,
    isSuper,
    phone,
  }: CreateUserDTO) {

    const emailAlreadyExists = await this.supabase
      .from('user')
      .select('email')
      .eq('email', email);

    if (emailAlreadyExists.data && emailAlreadyExists.data.length > 0) {
      throw new ConflictException('Email already exists. Try another.')
    }

    const passwordHashed = await bcrypt.hash(password, 8);
    const currentDate = new Date();

    const { data } = await this.supabase.from('user').insert([{
      name,
      email,
      is_super: isSuper,
      phone,
      password: passwordHashed,
      created_at: currentDate
    }]).select('id');

    const userId = data?.[0].id;

    if (condominiumId && userId) {
      const { error } = await this.supabase.from("user_association").insert([
        {
          user_id: userId,
          apartament_id: apartamentId,
          condominiumId: condominiumId,
          role: role ?? 'resident'
        }
      ])

      if (error) {
        throw new Error(error.message)
      }
    };

  }

  async createPlan({
    name,
    price,
    description,
    isCustom
  }: CreatePlanDTO) {

    const { error } = await this.supabase.from("plan").insert([{
      name,
      price,
      description,
      is_custom: isCustom
    }])

    if (error) {
      throw new Error(error.message)
    }
  }

  async createTenant({ name, planId, ownerId, isActive, lastPaymentAt }: CreateTenantDTO) {

    const { error } = await this.supabase.from('tenant').insert([{
      name,
      plan_id: planId,
      owner_id: ownerId,
      is_active: isActive,
      last_payment_at: lastPaymentAt
    }])

    if (error) {
      throw new Error(error.message)
    }
  }

  async createCondominium({
    name,
    city,
    tenantId,
    address,
    contactEmail,
    contactPhone,
    description,
    foundationDate,
    internalRegulations,
    manager,
    neighborhood,
    numberOfBlocks,
    numberOfUnits,
    postalCode,
    state,
    status,
  }: CreateCondominiumDTO) {
    const { error } = await this.supabase.from('condominium').insert([
      {
        name,
        city,
        tenant_id: tenantId,
        address,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        description,
        foundation_date: foundationDate,
        internal_regulations: internalRegulations,
        manager,
        neighborhood,
        number_of_blocks: numberOfBlocks,
        number_of_units: numberOfUnits,
        postal_code: postalCode,
        state,
        status,
      },
    ]);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getUsers() {
    const { data: users, error: usersError } = await this.supabase
      .from('user')
      .select(`*, user_association (*)`);

    if (usersError) throw new Error(usersError.message);

    return camelcaseKeys(users.map(user => flattenObject({ ...user, user_association: user.user_association?.[0] })), { deep: true })
  }

  async getUserById(userId: string) {
    const { data: users, error } = await this.supabase
      .from('user')
      .select(`*, user_association (*)`)
      .eq('id', userId);

    if (error) throw new Error(error.message);

    const currentUser = users?.[0];

    return camelcaseKeys(flattenObject({ ...currentUser, user_association: currentUser.user_association?.[0] }), { deep: true })
  }

  async getCondominiums() {
    const { data: condominiums, error } = await this.supabase
      .from('condominium')
      .select('*');

    if (error) throw new Error(error.message);

    return camelcaseKeys(condominiums, { deep: true });
  }
}