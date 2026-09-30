FROM node:lts-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build
RUN npm prune --omit=dev


FROM node:lts-alpine
WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

# All configuration is read at runtime — nothing is baked into the image.
# Set PUBLIC_TWITCH_CLIENT_ID, PUBLIC_TWITCH_REDIRECT_URI, ORIGIN and
# DISCORD_WEBHOOK_URL when starting the container.
ENV PORT=3000
ENV ORIGIN=http://localhost:3000

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "build"]
