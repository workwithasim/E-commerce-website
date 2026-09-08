FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

EXPOSE 5000

# Push DB schema, run seed data if not present, and launch production server
CMD ["sh", "-c", "npx prisma db push && (npx tsx prisma/seed.ts || true) && node dist/index.js"]
