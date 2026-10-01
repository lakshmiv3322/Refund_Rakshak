FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8000
EXPOSE 8000
CMD ["node", "dist/server.js"]
