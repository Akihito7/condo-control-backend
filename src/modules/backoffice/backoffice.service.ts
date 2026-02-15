import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import camelcaseKeys from 'camelcase-keys';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class BackofficeService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly mailerService: MailerService,
  ) {}

  async getCondominiums() {
    const { data } = await this.supabase
      .from('condominium')
      .select('id, name')
      .throwOnError();

    return data;
  }

  async getApartaments(condominiumId: string) {
    const { data } = await this.supabase
      .from('apartment')
      .select('id, apartment_number')
      .eq('condominium_id', condominiumId)
      .throwOnError();

    return camelcaseKeys(data);
  }

  async createUser(data: any) {
    console.log('data', data);

    const { count, error: usersError } = await this.supabase
      .from('user')
      .select('*')
      .eq('email', data.email);

    if (usersError) throw new Error(usersError.message);

    if (count && count > 0) {
      throw new ConflictException('Email already exists. Try another.');
    }

    const passwordHashed = await bcrypt.hash(data.password, 8);

    const { data: users, error } = await this.supabase
      .from('user')
      .insert({
        name: data.name,
        email: data.email,
        password: passwordHashed,
        is_super: data.isSuper,
        phone: data.phone,
        cpf: data.documentNumber,
        created_at: new Date(),
      })
      .select('*');

      console.log(error?.message)

    if (error) throw new BadRequestException(error.message);

    const currentUserId = users?.[0].id;

    const { data: userAssociations, error: userAssociationsError } =
      await this.supabase
        .from('user_association')
        .insert({
          user_id: currentUserId,
          apartment_id: data.apartamentId,
          condominium_id: data.condominiumId,
          role: data.role,
        })
        .select('*');

    if (userAssociationsError) throw new Error(userAssociationsError.message);

    const { data: condominiums, error: errorCondominiums } = await this.supabase
      .from('condominium')
      .select('name,id')
      .eq('id', data.condominiumId);

    if (errorCondominiums) throw new Error(errorCondominiums.message);

    const currentCondominiumName = condominiums?.[0].name;

    await this.mailerService.sendMail({
      to: data.email,
      subject: 'Acesso ao Portal do Condomínio',
      html: this.generateTemplateEmailCreateAccount({
        condominiumName: currentCondominiumName,
        email: data.email,
        password: data.password,
      }),
    });
  }

  private generateTemplateEmailCreateAccount({
    email,
    password,
    condominiumName,
  }: {
    email: string;
    password: string;
    condominiumName: string;
  }) {
    return `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 40px 20px;">
    <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px;">
      
      <h2 style="color: #2c3e50; margin-bottom: 10px;">
        Bem-vindo ao ${condominiumName} 👋
      </h2>

      <p style="color: #555; font-size: 14px;">
        Sua conta no portal do condomínio foi criada com sucesso.
      </p>

      <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Senha:</strong> ${password}</p>
      </div>

      <p style="color: #555; font-size: 14px;">
        Recomendamos que você altere sua senha após o primeiro acesso.
      </p>

      <div style="text-align: center; margin: 25px 0;">
        <a 
          href="https://condo-control-front-three.vercel.app/signin"
          style="
            background-color: #2563eb;
            color: #ffffff;
            padding: 12px 20px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          "
        >
          Acessar Portal
        </a>
      </div>

      <p style="font-size: 12px; color: #888; text-align: center;">
        Caso você não reconheça este cadastro, ignore este email.
      </p>

    </div>
  </div>
  `;
  }
}
