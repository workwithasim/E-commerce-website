FROM node:20-slim

WORKDIR /app

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
COPY data ./data/

RUN npm install
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

EXPOSE 5000

# Push DB schema, run seed data if needed, and launch production server
CMD ["sh", "-c", "npx prisma db push && (npx tsx prisma/seed.ts || true) && node dist/src/index.js"]
