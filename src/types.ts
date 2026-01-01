export interface BlockheadSettings {
    icsUrl: string;
    defaultTaskDuration: number; // in minutes
    workStartHour: number;
    workEndHour: number;
}

export const DEFAULT_SETTINGS: BlockheadSettings = {
    icsUrl: '',
    defaultTaskDuration: 30,
    workStartHour: 9,
    workEndHour: 17
}

export interface CalendarEvent {
    id: string;
    subject: string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    location?: {
        displayName: string;
    };
    bodyPreview?: string;
    organizer?: {
        emailAddress: {
            name: string;
            address: string;
        };
    };
    attendees?: Array<{
        emailAddress: {
            name: string;
            address: string;
        };
        status: {
            response: string;
        };
    }>;
}
