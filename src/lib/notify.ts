// Ekhon shudhu console-e log kore. Pore Twilio / local SMS gateway boshabo.
export const sendSms = async (phone: string, message: string) => {
  console.log(`[SMS -> ${phone}] ${message}`);
};