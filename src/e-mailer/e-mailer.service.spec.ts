import { MailerService } from '@nestjs-modules/mailer';
import { Test, TestingModule } from '@nestjs/testing';
import { EMailerService } from './e-mailer.service';

describe('EMailerService', () => {
  let service: EMailerService;
  let mailer: jest.Mocked<MailerService>;

  beforeEach(async () => {
    const mockMailer = { sendMail: jest.fn() } as any;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EMailerService,
        { provide: MailerService, useValue: mockMailer },
      ],
    }).compile();

    service = module.get<EMailerService>(EMailerService);
    mailer = module.get(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call sendMail with correct parameters on welcomeEmail', async () => {
    const data = { email: 'test@example.com' };
    await service.welcomeEmail(data);
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: data.email,
      subject: `Welcome: ${data.email}`,
      template: './welcome',
      context: { email: data.email },
    });
  });
});
