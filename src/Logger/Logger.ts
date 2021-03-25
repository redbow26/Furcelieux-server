import { createLogger, transports, format, LoggerOptions } from 'winston';
import {ConsoleTransportOptions, FileTransportOptions} from "winston/lib/winston/transports";
import capitalize from "../utils/Capitalize";

const { combine, colorize, metadata, timestamp, errors, printf } = format;

// Log format for the logger
const logFormat = combine(
    metadata({ fillExcept: ["level", "message", "timestamp"] }),
    timestamp(),
    errors({ stack: true }),
    printf(({ level, message, metadata, timestamp, stack }) => {
        let template = `${timestamp} `;

        if (metadata && metadata.label) {
            template += `[${metadata.label}]\t`;
            if (metadata.label.length <= 4)
                template += "\t";
        }
        if (stack)
            template += `${stack}`
        else
            template += `${capitalize(level)}:\t${message} `
        return template;
    }),
);

// File options for debug logger
const debugFileOption: FileTransportOptions = {
    level: "debug",
    filename: `./logs/debug.log`,
    maxsize: 10485760,
    maxFiles: 5,
    tailable: true,
    zippedArchive: true
};

// File options for error logger
const errorFileOption: FileTransportOptions = {
    level: "error",
    filename: `./logs/errors.log`,
    maxsize: 5242880,
    maxFiles: 5,
    tailable: true,
    zippedArchive: true
};

// Console options for debug logger
const debugConsoleOption: ConsoleTransportOptions = {
    level: "debug",
    format: combine(
        colorize(),
        logFormat,
    )
};

// Transport list for the logger
const transportsList = [
    new transports.Console(debugConsoleOption),
    new transports.File(debugFileOption),
    new transports.File(errorFileOption)
];

const options: LoggerOptions = {
    format: logFormat,
    transports: transportsList,
    handleExceptions: true,
    exceptionHandlers: [
        new transports.File(errorFileOption)
    ]
}
// Logger
export const logger = createLogger(options);

// Wait to the logger to finish
logger.on('finish', () => {

});

