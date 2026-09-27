#!/usr/bin/env bash
# Gera js/config.js a partir das variáveis de ambiente do Render
# (SUPABASE_URL e SUPABASE_ANON_KEY). Defina este ficheiro como parte
# do "Build Command" do seu Static Site no Render, por exemplo:
#
#   bash generate-config.sh
#
# Assim, a chave nunca fica fixa no repositório — só existe em runtime
# de build, lida das Environment Variables do Render.

set -euo pipefail

: "${SUPABASE_URL:?Defina SUPABASE_URL nas Environment Variables do Render}"
: "${SUPABASE_ANON_KEY:?Defina SUPABASE_ANON_KEY nas Environment Variables do Render}"

cat > js/config.js <<EOF
window.APP_CONFIG = {
  SUPABASE_URL: "${SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY}",
};
EOF

echo "js/config.js gerado com sucesso a partir das variáveis de ambiente."
