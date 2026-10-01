# Instruções

- Depois de cada alteração: `npm run build` e `npx firebase-tools deploy --only hosting --project tfm-siteweb`.
  Credencial lida da variável de ambiente `GOOGLE_APPLICATION_CREDENTIALS` (caminho do JSON da conta de serviço)
  ou `FIREBASE_TOKEN`. Sem credencial, avise o usuário que o deploy não foi feito.
