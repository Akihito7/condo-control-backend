import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import * as bcrypt from "bcrypt"
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from "@nestjs/jwt";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { flattenObject } from "src/utils/flatten-object";
import { User } from "./types/response/auth.response";
import camelcaseKeys from "camelcase-keys";
import { generateCode } from "src/utils/generate-code";
import { MailerService } from "@nestjs-modules/mailer";
import { isAfter, parseISO } from "date-fns";


type DecodeResponse = {
  userId: number
  iat: 1751509059,
  aud: 'login',
  iss: 'login-route'
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService
  ) { }

  async createAccount(data: any) {
    const emailAlreadyExists = await this.supabase
      .from('user')
      .select('email')
      .eq('email', data.email);

    if (emailAlreadyExists.data && emailAlreadyExists.data.length > 0) {
      throw new ConflictException('Email already exists. Try another.')
    }

    const { data: tenantData } =
      await this.supabase.from('tenant').insert([
        {
          id: uuidv4(),
          name: `Initial Tenant To User ${data.email}`,
          plan_id: null,
          stripe_customer_id: null,
          created_at: new Date().toISOString(),
        }
      ]).select('id');

    const tenantId = tenantData?.[0].id;

    const id = uuidv4();

    const passwordHashed = await bcrypt.hash(data.password, 8);

    await this.supabase
      .from('user')
      .insert([
        {
          id,
          name:
            data.name,
          email: data.email,
          tenant_id:
            tenantId,
          phone:
            data.phone,
          password: passwordHashed,
          created_at: new Date().toISOString(),
        }
      ]);
  }

  async login(data: any) {

    const result = await this.supabase.from('user')
      .select('id, email, password').eq('email', data.email);

    const user = result.data?.[0];

    if (result.error) {
      throw new Error(result.error.message)
    }

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);


    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = await this.generateToken(user.id);

    return {
      token,
    }
  }

  async me(userId: number) {

    const resultUsers = await this
      .supabase.from("user")
      .select(`*,
        user_association (*)
        `)
      .eq("id", userId);

    const user = resultUsers.data?.[0];
    const userRole = user.user_association?.[0]?.role;

    const { data: pagesWithPermissionByRole } = await this.supabase
      .from('role_page_relation')
      .select(`*, page (*)`)
      .eq('role_name', userRole);

    const { data: modulesWithPermissionByRole } = await this.supabase
      .from('role_module_relation')
      .select(`*, module (*)`)
      .eq('role_name', userRole);


    const pagesWithPermissionByRoleFormatted = camelcaseKeys(pagesWithPermissionByRole?.map(page => flattenObject(page)) ?? []);
    const modulesWithPermissionByRoleFormatted = camelcaseKeys(modulesWithPermissionByRole?.map(module => flattenObject(module)) ?? []);

    const tabStructure = modulesWithPermissionByRoleFormatted
      .filter((module: any) => !!module.read)
      .map((module: any) => {
        const pagesToThisModule = pagesWithPermissionByRoleFormatted.filter((page: any) => page.pageModuleId === module.moduleId && !!page.read);
        return {
          moduleId: module.moduleId,
          moduleName: module.moduleName,
          moduleRoutePath: module.moduleRoutePath,
          modulePages: pagesToThisModule,
        }
      })
    const normalizedData = {
      ...user,
      user_association: user.user_association?.[0],
      condominiumId: user.user_association?.[0]?.condominium_id || null,
      pagesWithPermissionByRole: pagesWithPermissionByRoleFormatted,
      modulesWithPermissionByRole: modulesWithPermissionByRoleFormatted,
      tabStructure
    }

    const userObjectFlatten = camelcaseKeys(flattenObject(normalizedData)) as User;
    return userObjectFlatten

  }

  async generateToken(userId: string) {
    return this.jwtService.sign({
      userId
    }, {
      audience: 'login',
      issuer: 'login-route'
    })
  }

  async decodeToken(token: string): Promise<DecodeResponse> {
    return this.jwtService.decode(token)
  }

  async verifyToken(token: string) {
    return this.jwtService.verifyAsync(token);
  }

  async forgetPassword({ email }: { email: string }) {

    const { data, error } = await this.supabase
      .from('user')
      .select("*")
      .eq('email', email);

    if (error) throw new Error(error.message);

    const currentUserInfo = data?.[0];

    if (!currentUserInfo) throw new Error("Nenhum usuario encontrado com esse email");

    const code = generateCode();

    const { error: codeError } = await this.supabase
      .from('confirmation_codes')
      .insert({
        code,
        register_id: currentUserInfo.id,
        table_reference: 'user',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
      })

    if (codeError) throw new Error(codeError.message);

    const html = `
            <div style="font-family: Arial, sans-serif; line-height:1.5; color:#333;">
              <h2 style="color:#1E40AF;">Redefinição de Senha</h2>
              <p>Olá,</p>
              <p>Recebemos uma solicitação para redefinir a sua senha. Use o código abaixo para continuar:</p>
              <div style="margin: 20px 0; padding: 15px; background-color:#f4f4f4; border-radius:8px; text-align:center; font-size:24px; font-weight:bold; letter-spacing:2px;">
                ${code}
              </div>
              <p>Este código é válido por <strong>15 minutos</strong>.</p>
              <p>Se você não solicitou a redefinição, apenas ignore este email.</p>
              <p>Obrigado,<br/><strong>CondoControl</strong></p>
            </div>
          `;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Redefinição de Senha - CondoControl',
      html,
    })
  }

  async resetPassword({ password, code }: { password: string, code: string }) {
    const { data: codes, error } = await this.supabase
      .from('confirmation_codes')
      .select('*')
      .eq('code', code);

    if (error) throw new Error(error.message);

    const currentCodeInformation = codes?.[0];

    if (!currentCodeInformation) throw new Error('Codigo invalido');

    const alreadyUsed = currentCodeInformation.used;

    if (alreadyUsed) throw new Error('codigo ja usado');

    const now = new Date();
    const expiresAt = parseISO(currentCodeInformation.expires_at);

    const alreadyCodeExpired = isAfter(now, expiresAt);

    if (alreadyCodeExpired) throw new Error('Codigo expirado');

    const userId = currentCodeInformation.register_id;

    const passwordHashed = await bcrypt.hash(password, 8);

    const { error: userUpdateError } = await this.supabase.from('user').update({
      password: passwordHashed,
      updated_at: new Date()
    })
      .eq('id', userId)

    if (userUpdateError) throw new Error(userUpdateError.message);

    const { error: updateCodeError } = await this.supabase.from('confirmation_codes').update({
      used: true
    })
      .eq('id', currentCodeInformation.id);

    if (updateCodeError) throw new Error(updateCodeError.message)
  }
}