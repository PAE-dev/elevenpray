import { IsString, Matches } from 'class-validator';

export class ConnectWhatsAppDto {
  @IsString()
  @Matches(/^\+\d{10,15}$/, {
    message: 'El número debe estar en formato internacional, por ejemplo +51987654321',
  })
  phone: string;
}
