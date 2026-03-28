FROM node:lts-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# PUBLIC_* vars are baked in at build time — pass them as build args
ARG PUBLIC_TWITCH_CLIENT_ID
ARG PUBLIC_TWITCH_REDIRECT_URI
ENV PUBLIC_TWITCH_CLIENT_ID=$PUBLIC_TWITCH_CLIENT_ID
ENV PUBLIC_TWITCH_REDIRECT_URI=$PUBLIC_TWITCH_REDIRECT_URI

RUN npm run build
RUN npm prune --omit=dev


FROM node:lts-alpine
WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

# DISCORD_WEBHOOK_URL is set at runtime (not baked into the image)
ENV PORT=3000
ENV ORIGIN=http://localhost:3000

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "build"]
