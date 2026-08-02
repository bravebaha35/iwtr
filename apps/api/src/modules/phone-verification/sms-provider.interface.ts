// Swappable SMS-gateway boundary — same pattern as IPaymentProvider in the
// payments module. Nothing above this interface (PhoneVerificationService,
// the onboarding controller) depends on which real gateway is behind it.
export interface ISmsProvider {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol("SMS_PROVIDER");
