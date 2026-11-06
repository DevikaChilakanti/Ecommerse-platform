import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NextFunction, Request, Response } from "express";
import cookieParser = require("cookie-parser");

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const frontendOrigin = config.get<string>("FRONTEND_ORIGIN");
  if (!frontendOrigin && config.get<string>("NODE_ENV") === "production") {
    throw new Error("FRONTEND_ORIGIN must be configured in production.");
  }
  const allowedOrigin = frontendOrigin ?? "http://localhost:3000";

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });
  app.use(
    (request: Request, response: Response, next: NextFunction): void => {
      const origin = request.get("origin");
      if (
        origin &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
        origin !== allowedOrigin
      ) {
        response.status(403).json({
          statusCode: 403,
          message: "Origin not allowed.",
          error: "Forbidden",
        });
        return;
      }
      next();
    },
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}
