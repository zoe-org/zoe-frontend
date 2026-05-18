/** Mapeia erros do Amplify Auth (Cognito) para mensagens pt-BR. */
export function translateCognitoError(err: unknown): { code: string; message: string } {
  const e = err as { name?: string; message?: string } | undefined
  const name = e?.name ?? "UnknownError"
  switch (name) {
    case "NotAuthorizedException":
      return { code: name, message: "E-mail ou senha incorretos." }
    case "UserNotFoundException":
      return { code: name, message: "Conta não encontrada." }
    case "UserNotConfirmedException":
      return { code: name, message: "Confirme seu e-mail antes de entrar." }
    case "PasswordResetRequiredException":
      return { code: name, message: "Você precisa redefinir sua senha." }
    case "UsernameExistsException":
      return { code: name, message: "Já existe uma conta com esse e-mail." }
    case "InvalidPasswordException":
      return { code: name, message: "Senha não atende aos requisitos mínimos." }
    case "CodeMismatchException":
      return { code: name, message: "Código de verificação inválido." }
    case "ExpiredCodeException":
      return { code: name, message: "Código expirado. Solicite um novo." }
    case "LimitExceededException":
    case "TooManyRequestsException":
      return { code: name, message: "Muitas tentativas. Aguarde alguns minutos." }
    case "NetworkError":
      return { code: name, message: "Falha de rede. Verifique sua conexão." }
    default:
      return { code: name, message: e?.message ?? "Erro inesperado. Tente novamente." }
  }
}
