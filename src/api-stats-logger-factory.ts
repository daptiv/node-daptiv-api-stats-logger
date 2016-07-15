'use strict';
import { ApiStatKeyBuilder } from './api-stat-key-builder';
import { Server, RouteSpec, Response, Request, Route } from 'restify';
import { DaptivStatsLogger } from 'node-daptiv-stats-logger';

/**
 * tuple of [seconds, nanoseconds]
 */
type HighResolutionTime = [number, number];

export const DEFAULT_KEY_NAME: string = 'handler-0';

export function registerHandledRouteTimingMetrics(server: Server, statsLogger: DaptivStatsLogger) {
  // A logger and apiStatKeyBuilder should NOT be created here, they should be provided by the caller.
    let apiStatKeyBuilder = new ApiStatKeyBuilder();
    let apiMetricsLogger = new ApiStatsLoggerFactory(statsLogger, apiStatKeyBuilder).createLogger();

    server.on('after', (request: Request, response: Response, route: Route, error) => {
        apiMetricsLogger(request, response, route);
    });
}

export class ApiStatsLoggerFactory {
    constructor(private statsLogger: DaptivStatsLogger, private apiStatKeyBuilder: ApiStatKeyBuilder) {}

    createLogger() {
        return (request: Request, response: Response, route: Route) => {
            // Ignore requests without timers, e.g. OPTIONS
            if (!request.timers) {
                return;
            }

            let timer = request.timers.find((item) => {
                return item.name === route.name || item.name === DEFAULT_KEY_NAME;
            });
            if (!timer) {
                return;
            }

            let routeSpec: RouteSpec = route && route.spec;
            let key: string = this.apiStatKeyBuilder.fromRouteSpecAndStatus(routeSpec, response.statusCode);
            let time = this.toMilliseconds(timer.time);
            if (time) {
                this.statsLogger.timing(key, time);
            }

            // TODO: increment success and failure (4XX, 5XX)
        };
    }

    private toMilliseconds(hrTime: HighResolutionTime): number {
        let milliSeconds = hrTime[0] * 1000; // seconds to milliseconds
        milliSeconds += hrTime[1] / 1000000; // nanoseconds to milliseconds
        return milliSeconds;
    }
};
