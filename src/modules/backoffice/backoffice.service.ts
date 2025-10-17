import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import * as bcrypt from "bcrypt";
import { CreateCondominiumDTO, CreatePlanDTO, CreateTenantDTO, CreateUserDTO } from "./types/dto/backoffice.dto";
import camelcaseKeys from "camelcase-keys";
import { flattenObject } from "src/utils/flatten-object";


@Injectable()
export class BackofficeService {

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient
  ) { }

  async createUser({
    condominiumId,
    apartamentId,
    role,
    name,
    email,
    password,
    isSuper,
    phone,
    documentNumber
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

    const { data, error } = await this.supabase.from('user')
      .insert([{
        name,
        email,
        is_super: isSuper,
        phone,
        cpf: documentNumber,
        password: passwordHashed,
        created_at: currentDate
      }]).select('id');

    if (error) throw new Error(error.message);

    const userId = data?.[0].id;

    if (condominiumId && userId) {
      const { error } = await this.supabase.from("user_association").insert([
        {
          user_id: userId,
          apartment_id: apartamentId,
          condominium_id: condominiumId,
          role: role ?? 'resident'
        }
      ])

      if (error) {
        throw new Error(error.message)
      }
    };

  }

  async updateUser(userId: string, user: CreateUserDTO) {

    const { data: users, error: errorUsers } = await this.supabase.from("user").select("*").eq('id', userId).not('is_deleted', 'is', true)

    if (errorUsers) throw new Error(errorUsers.message);

    const currentUser = users?.[0];

    if (!currentUser) throw new NotFoundException('User Not Found');

    if (currentUser.email !== user.email) {
      const { count, error } = await this.supabase.from('user').select('*').eq('email', user.email).eq('is_deleted', false)

      if (error) throw new Error(error.message);

      if (count && count > 1) throw new Error('Informacoes nao atualizados por causa que o email ja esta em uso.');

      await this.supabase
        .from('user')
        .update({
          email: user.email
        })
        .eq('id', userId)
    }

    if (currentUser.cpf !== user.documentNumber) {
      const { data, error } = await this.supabase.from('user').select('*').eq('cpf', user.documentNumber).not('is_deleted', 'is', true)

      if (error) throw new Error(error.message);

      if (data && data.length > 0) throw new Error('Informacoes nao atualizados por causa que o cpf ja esta em uso.');

      await this.supabase
        .from('user')
        .update({
          cpf: user.documentNumber
        })
        .eq('id', userId)
    }

    if (user.password) {
      const isSamePassword = await bcrypt.compare(currentUser.password, user.password);

      if (!isSamePassword) {

        const passwordHashed = await bcrypt.hash(user.password, 8)
        await this.supabase.from('user').update({
          password: passwordHashed
        }).eq('id', userId)
      }

    }

    if (user.condominiumId) {
      const { data: associations, error } = await this.supabase.from('user_association').select('*').eq('user_id', userId);

      if (error) throw new Error(error.message);

      const currentAssociation = associations?.[0];

      if (!currentAssociation) {
        return this.supabase
          .from("user_association")
          .insert({
            user_id: userId,
            apartment_id: user.apartamentId,
            condominium_id: user.condominiumId,
            role: user.role ?? 'resident'
          }
          )
      }
      if (currentAssociation.condominium_id === Number(user.condominiumId)) {
        await this.supabase
          .from("user_association")
          .update({
            apartment_id: user.apartamentId,
            condominium_id: user.condominiumId,
            role: user.role ?? 'resident'
          }
          ).eq('user_id', userId)

        return;
      }

      await this.supabase.from('user_association').delete().eq('id', currentAssociation.id)

      return this.supabase
        .from("user_association")
        .insert({
          user_id: userId,
          apartment_id: user.apartamentId,
          condominium_id: user.condominiumId,
          role: user.role ?? 'resident'
        }
        )
    }

  }

  async deleteUser(userId: string) {
    const { error: userError } = await this.supabase.from('user').update({
      is_deleted: true
    })
      .eq("id", userId)
    if (userError) throw new Error(userError.message);
  }

  async createPlan({
    name,
    price,
    description,
    isCustom
  }: CreatePlanDTO) {

    const { error } = await this.supabase.from("plan").insert({
      name,
      price,
      description,
      is_custom: isCustom
    })

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
      .select(`*, user_association (*)`)
      .not('is_deleted', 'is', true)

    if (usersError) throw new Error(usersError.message);

    return camelcaseKeys(users.map(user => flattenObject({ ...user, user_association: user.user_association?.[0] })), { deep: true })
  }

  async getUserById(userId: string) {
    const { data: users, error } = await this.supabase
      .from('user')
      .select(`*, user_association (*)`)
      .eq('id', userId)
      .not('is_deleted', 'is', true)

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

  async getApartaments() {
    const { data: apartaments, error } = await this.supabase
      .from("apartment")
      .select('*');

    if (error) throw new Error(error.message);

    return camelcaseKeys(apartaments, { deep: true });
  }

  async getPlans() {
    const { data: plans, error } = await this.supabase.from('plan').select('*');

    if (error) throw new Error(error.message);

    return camelcaseKeys(plans, { deep: true })
  }

  async getTenants() {
    const { data: tenants, error } = await this.supabase.from('tenant').select('*');

    if (error) throw new Error(error.message);

    return camelcaseKeys(tenants, { deep: true })
  }

  async getPages() {
    const { data: pages, error } = await this.supabase.from('page').select('*');
    if (error) throw new Error(error.message);
    return camelcaseKeys(pages, { deep: true })
  }

  async getPlanById(planId: string) {
    const { data: plans, error } = await this.supabase
      .from('plan')
      .select(`*, plan_page (*)`)
      .eq('id', planId)

    if (error) throw new Error(error.message);

    const currentPlan = plans?.[0];

    return camelcaseKeys(currentPlan, { deep: true })
  }

  async getModules() {
    const { data: modules, error } = await this.supabase.from('module').select('*');
    if (error) throw new Error(error.message);
    return camelcaseKeys(modules, { deep: true })
  }

  async updatePlan(planId: string, data: any) {

    const { pages } = data;

    const { data: plans, error: plansError } = await this.supabase
      .from('plan')
      .select(`*, plan_page (*)`)
      .eq('id', planId);

    if (plansError) throw new Error(plansError.message);


    if (plans.length === 0) throw new Error('plan not found.');

    const currentPlan = camelcaseKeys(plans?.[0]);
    const currentPagesPlanId = currentPlan.planPage.map(page => page.page_id);

    const pagesToAdd = pages.filter(page => !currentPagesPlanId.includes(page.pageId));


    const pagesFromRequestIds = pages.map(page => page.pageId)
    const pagesToRemove = currentPagesPlanId.filter(currentPageId => !pagesFromRequestIds.includes(currentPageId));


    await Promise.all(pagesToAdd.map(async page => {
      await this.supabase
        .from('plan_page')
        .insert({
          plan_id: planId,
          page_id: page.pageId,
          created_at: new Date(),
        })

    }))


    const { error: deletePlanPageError } = await this.supabase
      .from('plan_page')
      .delete()
      .eq('plan_id', planId)
      .in('page_id', pagesToRemove)

    if (deletePlanPageError) throw new Error(deletePlanPageError.message)

    const { error } = await this.supabase
      .from('plan')
      .update({
        name: data.name,
        description: data.description,
        is_custom: data.is_custom,
        price: data.price
      })
      .eq('id', planId)

    if (error) throw new Error(error.message)
  }
}