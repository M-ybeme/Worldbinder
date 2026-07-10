import { Injectable } from '@nestjs/common';
import { apiEnvSchema, loadEnv, type ApiEnv } from '@worldbinder/config';

@Injectable()
export class EnvService {
  readonly values: ApiEnv = loadEnv(apiEnvSchema);
}
