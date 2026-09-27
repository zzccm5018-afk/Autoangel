/**
 * CONFIGURAÇÃO SUPABASE
 * ---------------------------------------------------------
 * Preencha com os dados do SEU projeto Supabase
 * (Project Settings → API → Project URL / anon public key).
 *
 * NO RENDER (recomendado):
 *   Não deixe a chave escrita fixa aqui em produção. Em vez disso:
 *   1. No Render, vá a "Environment" e crie:
 *        SUPABASE_URL       = https://xxxxxxxx.supabase.co
 *        SUPABASE_ANON_KEY  = xxxxxxxxxxxxxxxxxxxxxxxx
 *   2. Use o "Build Command" do ficheiro generate-config.sh (na raiz do
 *      projeto) para gerar este ficheiro automaticamente a partir das
 *      variáveis de ambiente a cada deploy:
 *        bash generate-config.sh
 *   3. Isso substitui os valores abaixo pelos valores reais do Render
 *      no momento do build — o código do site nunca muda.
 *
 * Para TESTE LOCAL rápido, pode simplesmente escrever os valores
 * diretamente nas duas linhas abaixo.
 */
window.APP_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "SUA_CHAVE_ANON_AQUI",
};
