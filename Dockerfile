FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then npm install; fi && npm run dev -- --host 0.0.0.0 --port 5173"]
