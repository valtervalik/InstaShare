import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { toFileStream } from 'qrcode';
import { TypedEventEmitter } from 'src/common/types/typed-event-emitter/typed-event-emitter.class';
import { ChangePasswordDto } from 'src/users/dto/change-password.dto';
import { UserDocument } from 'src/users/schemas/user.schema';
import { apiResponseHandler } from 'src/utils/ApiResponseHandler';
import { REFRESH_TOKEN_KEY } from '../auth.constants';
import { ActiveUser } from '../decorators/active-user.decorator';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { AuthenticationService } from './authentication.service';
import { Auth } from './decorators/auth.decorator';
import { SignUpDto } from './dto/sign-up.dto';
import { AuthType } from './enums/auth-type.enum';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service';

@Controller('auth')
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name);

  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  @Auth(AuthType.None)
  @Post('sign-up')
  async signUp(@Body() signUpDto: SignUpDto) {
    if (signUpDto.password !== signUpDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.authenticationService.create(signUpDto);

    this.eventEmitter.emit('user.welcome', {
      email: signUpDto.email,
    });

    return apiResponseHandler(
      'User registered successfully',
      HttpStatus.CREATED,
      user,
    );
  }

  @Auth(AuthType.None)
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('sign-in')
  async signIn(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const accessToken = await this.authenticationService.generateTokens(
      request.user as UserDocument,
      response,
    );

    return apiResponseHandler('Login successful', HttpStatus.OK, accessToken);
  }

  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies[REFRESH_TOKEN_KEY];
    return this.authenticationService.refreshToken(refreshToken, response);
  }

  @HttpCode(HttpStatus.OK)
  @Post('2fa/generate')
  async generateQrCode(
    @ActiveUser() activeUser: ActiveUserData,
    @Res() response: Response,
  ) {
    const { secret, uri } = await this.twoFactorAuthService.generateSecret(
      activeUser.email,
    );

    await this.twoFactorAuthService.enableTFAForUser(activeUser.email, secret);
    response.type('png');
    return toFileStream(response, uri);
  }

  @HttpCode(HttpStatus.OK)
  @Post('2fa/disable')
  async disableTFA(@ActiveUser() activeUser: ActiveUserData) {
    await this.twoFactorAuthService.disableTFAForUser(activeUser.email);

    return apiResponseHandler(
      'Two-factor authentication disabled successfully',
      HttpStatus.OK,
    );
  }

  @Get('current-user')
  async getCurrentUser(@ActiveUser() activeUser: ActiveUserData) {
    return (await this.authenticationService.findById(activeUser.sub)).populate(
      ['role', 'permission'],
    );
  }

  @Auth(AuthType.None)
  @Get('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(REFRESH_TOKEN_KEY);
    return apiResponseHandler('Logout successful', HttpStatus.OK);
  }

  @Patch('change-password')
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    this.logger.log(`Changing password for user with id ${activeUser.sub}`);

    const { email, oldPassword, password, confirmPassword } = changePasswordDto;

    const user = await this.authenticationService.validateUser(
      email,
      oldPassword,
    );

    if (user._id.toString() !== activeUser.sub) {
      throw new BadRequestException(
        'No es posible cambiar la contraseña de otro usuario',
      );
    }

    if (password !== confirmPassword) {
      throw new BadRequestException('Credenciales incorrectas');
    }

    await this.authenticationService.update(
      user._id.toString(),
      { password },
      { new: false },
    );

    this.logger.log(
      `Password changed successfully for user with id ${activeUser.sub}`,
    );

    return apiResponseHandler(
      `Contraseña actualizada exitosamente`,
      HttpStatus.OK,
    );
  }
}
