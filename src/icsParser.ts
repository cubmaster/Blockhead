import { requestUrl } from 'obsidian';
import type { CalendarEvent } from './types';

export class ICSParser {
    async fetchAndParse(icsUrl: string): Promise<CalendarEvent[]> {
        try {
            const response = await requestUrl({
                url: icsUrl,
                method: 'GET'
            });

            return this.parseICS(response.text);
        } catch (error) {
            console.error('Failed to fetch ICS:', error);
            throw new Error('Failed to fetch calendar from ICS URL');
        }
    }

    private parseICS(icsData: string): CalendarEvent[] {
        const events: CalendarEvent[] = [];
        const lines = icsData.split(/\r?\n/);

        let currentEvent: Partial<CalendarEvent> | null = null;
        let currentField = '';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Handle line continuation
            while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
                i++;
                line += lines[i].trim();
            }

            if (line === 'BEGIN:VEVENT') {
                currentEvent = {
                    id: '',
                    subject: '',
                    start: { dateTime: '', timeZone: 'UTC' },
                    end: { dateTime: '', timeZone: 'UTC' }
                };
            } else if (line === 'END:VEVENT' && currentEvent) {
                if (currentEvent.id && currentEvent.subject && currentEvent.start?.dateTime && currentEvent.end?.dateTime) {
                    events.push(currentEvent as CalendarEvent);
                }
                currentEvent = null;
            } else if (currentEvent) {
                const colonIndex = line.indexOf(':');
                if (colonIndex === -1) continue;

                const fieldPart = line.substring(0, colonIndex);
                const valuePart = line.substring(colonIndex + 1);

                // Extract field name (before any semicolon parameters)
                const fieldName = fieldPart.split(';')[0];

                switch (fieldName) {
                    case 'UID':
                        currentEvent.id = valuePart;
                        break;
                    case 'SUMMARY':
                        currentEvent.subject = this.unescapeText(valuePart);
                        break;
                    case 'DTSTART':
                        currentEvent.start = {
                            dateTime: this.parseDateTime(valuePart, fieldPart),
                            timeZone: this.extractTimeZone(fieldPart) || 'UTC'
                        };
                        break;
                    case 'DTEND':
                        currentEvent.end = {
                            dateTime: this.parseDateTime(valuePart, fieldPart),
                            timeZone: this.extractTimeZone(fieldPart) || 'UTC'
                        };
                        break;
                    case 'LOCATION':
                        currentEvent.location = {
                            displayName: this.unescapeText(valuePart)
                        };
                        break;
                    case 'DESCRIPTION':
                        currentEvent.bodyPreview = this.unescapeText(valuePart);
                        break;
                }
            }
        }

        return events;
    }

    private parseDateTime(value: string, fieldPart: string): string {
        // Remove any TZID parameter value
        value = value.trim();

        // ICS format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
        // Convert to ISO 8601
        if (value.length >= 15) {
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            const hour = value.substring(9, 11);
            const minute = value.substring(11, 13);
            const second = value.substring(13, 15);

            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        }

        return value;
    }

    private extractTimeZone(fieldPart: string): string | null {
        const tzidMatch = fieldPart.match(/TZID=([^:;]+)/);
        return tzidMatch ? tzidMatch[1] : null;
    }

    private unescapeText(text: string): string {
        return text
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\');
    }
}
