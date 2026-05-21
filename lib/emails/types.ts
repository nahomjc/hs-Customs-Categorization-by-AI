export type SendEmailHookUser = {
  email: string;
  new_email?: string;
};

export type SendEmailHookEmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
};

export type SendEmailHookPayload = {
  user: SendEmailHookUser;
  email_data: SendEmailHookEmailData;
};

export type AuthEmailTemplateInput = {
  siteUrl: string;
  confirmationUrl: string;
  email: string;
};

export type AuthEmailMessage = {
  subject: string;
  html: string;
};
