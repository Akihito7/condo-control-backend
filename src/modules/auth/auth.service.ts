import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import * as bcrypt from "bcrypt"
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from "@nestjs/jwt";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";


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
    private readonly jwtService: JwtService
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

    const normalizedData = {
      ...user,
      condominiumId: user.user_association?.[0]?.condominium_id || null
    }

    return normalizedData

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
}