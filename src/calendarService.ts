import type { CalendarEvent } from './types';
import { ICSParser } from './icsParser';

export class CalendarService {
    private icsParser: ICSParser;
    private icsUrl: string;
    private cachedEvents: CalendarEvent[] = [];
    private lastFetch: number = 0;
    private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

    constructor(icsUrl: string) {
        this.icsUrl = icsUrl;
        this.icsParser = new ICSParser();
    }

    async getCalendarEvents(daysAhead: number = 7): Promise<CalendarEvent[]> {
        // Check cache
        if (this.cachedEvents.length > 0 && Date.now() - this.lastFetch < this.cacheTimeout) {
            return this.filterEventsByDays(this.cachedEvents, daysAhead);
        }

        // Fetch fresh data
        if (!this.icsUrl) {
            throw new Error('ICS URL not configured. Please set it in settings.');
        }

        this.cachedEvents = await this.icsParser.fetchAndParse(this.icsUrl);
        this.lastFetch = Date.now();

        return this.filterEventsByDays(this.cachedEvents, daysAhead);
    }

    async getTodayEvents(): Promise<CalendarEvent[]> {
        const allEvents = await this.getCalendarEvents(1);
        const today = new Date();

        return allEvents.filter(event => {
            const eventDate = new Date(event.start.dateTime);
            return eventDate.toDateString() === today.toDateString();
        });
    }

    private filterEventsByDays(events: CalendarEvent[], days: number): CalendarEvent[] {
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        return events.filter(event => {
            const eventStart = new Date(event.start.dateTime);
            return eventStart >= now && eventStart <= endDate;
        }).sort((a, b) => {
            return new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime();
        });
    }

    formatEventForNote(event: CalendarEvent): string {
        const startTime = new Date(event.start.dateTime);
        const endTime = new Date(event.end.dateTime);

        const timeStr = `${startTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })} - ${endTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })}`;

        let result = `- **${event.subject}**\n`;
        result += `  - Time: ${timeStr}\n`;

        if (event.location?.displayName) {
            result += `  - Location: ${event.location.displayName}\n`;
        }

        if (event.bodyPreview) {
            result += `  - ${event.bodyPreview}\n`;
        }

        return result;
    }

    updateIcsUrl(url: string): void {
        this.icsUrl = url;
        this.cachedEvents = [];
        this.lastFetch = 0;
    }

    clearCache(): void {
        this.cachedEvents = [];
        this.lastFetch = 0;
    }
}
