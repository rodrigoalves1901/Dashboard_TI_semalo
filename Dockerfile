FROM node:22-alpine

WORKDIR /app

# Variáveis públicas para o build do Vite (com valores padrão do projeto dashboard)
ARG VITE_SUPABASE_URL="https://eswqkdgqkcdegtblzrzq.supabase.co"
ARG VITE_SUPABASE_ANON_KEY="sb_publishable_tg9AAH_jHwFw_s4MrGlnZg_R29tQIud"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Instala dependências
COPY package.json package-lock.json ./
RUN npm ci

# Copia o código-fonte e gera o build de produção (Client + SSR Server Functions)
COPY . .
RUN npm run build

EXPOSE 8087

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8087"]

