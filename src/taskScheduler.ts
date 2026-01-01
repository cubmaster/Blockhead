import type { CalendarEvent } from './types';

export interface Task {
    title: string;
    priority: number; // 1-5, where 1 is highest priority
    duration?: number; // in minutes
    dueDate?: Date;
    scheduledDate?: Date; // For tasks with specific scheduled time (Tasks plugin)
    startDate?: Date; // For tasks with start date
    isRecurring?: boolean;
    tags?: string[];
    filePath?: string; // Source file path
}

export interface TimeSlot {
    start: Date;
    end: Date;
    available: boolean;
}

export interface ScheduledTask extends Task {
    scheduledStart: Date;
    scheduledEnd: Date;
}

export class TaskScheduler {
    private defaultDuration: number;
    private workStartHour: number;
    private workEndHour: number;

    constructor(defaultDuration: number, workStartHour: number, workEndHour: number) {
        this.defaultDuration = defaultDuration;
        this.workStartHour = workStartHour;
        this.workEndHour = workEndHour;
    }

    /**
     * Find available time slots in a day given existing calendar events
     */
    findAvailableSlots(date: Date, events: CalendarEvent[]): TimeSlot[] {
        const slots: TimeSlot[] = [];

        const dayStart = new Date(date);
        dayStart.setHours(this.workStartHour, 0, 0, 0);

        const dayEnd = new Date(date);
        dayEnd.setHours(this.workEndHour, 0, 0, 0);

        // Filter events for this specific day
        const dayEvents = events.filter(event => {
            const eventStart = new Date(event.start.dateTime);
            return eventStart.toDateString() === date.toDateString();
        }).sort((a, b) => {
            return new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime();
        });

        let currentTime = dayStart;

        for (const event of dayEvents) {
            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime);

            // Add available slot before this event
            if (currentTime < eventStart) {
                slots.push({
                    start: new Date(currentTime),
                    end: new Date(eventStart),
                    available: true
                });
            }

            // Add busy slot for the event
            slots.push({
                start: eventStart,
                end: eventEnd,
                available: false
            });

            currentTime = eventEnd;
        }

        // Add remaining time after last event
        if (currentTime < dayEnd) {
            slots.push({
                start: new Date(currentTime),
                end: new Date(dayEnd),
                available: true
            });
        }

        return slots;
    }

    /**
     * Schedule tasks in available time slots based on priority
     * Handles both tasks with explicit scheduled times and tasks needing auto-scheduling
     */
    scheduleTasks(tasks: Task[], events: CalendarEvent[], startDate: Date, days: number = 7): ScheduledTask[] {
        const scheduledTasks: ScheduledTask[] = [];

        // Separate tasks with explicit scheduled times from those needing auto-scheduling
        const explicitTasks: Task[] = [];
        const autoScheduleTasks: Task[] = [];

        for (const task of tasks) {
            if (task.scheduledDate) {
                explicitTasks.push(task);
            } else {
                autoScheduleTasks.push(task);
            }
        }

        // Handle tasks with explicit scheduled times first
        for (const task of explicitTasks) {
            const duration = task.duration || this.defaultDuration;
            const durationMs = duration * 60 * 1000;

            const scheduledStart = new Date(task.scheduledDate!);
            const scheduledEnd = new Date(scheduledStart.getTime() + durationMs);

            scheduledTasks.push({
                ...task,
                scheduledStart,
                scheduledEnd
            });
        }

        // Sort auto-schedule tasks by priority (1 = highest) and then by due date
        const sortedAutoTasks = [...autoScheduleTasks].sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            if (a.dueDate && b.dueDate) {
                return a.dueDate.getTime() - b.dueDate.getTime();
            }
            return 0;
        });

        // Get available slots for each day, considering both calendar events and already scheduled tasks
        const allSlots: { date: Date; slots: TimeSlot[] }[] = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            // Skip weekends (optional - could be a setting)
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;

            const slots = this.findAvailableSlots(date, events);

            // Block out time for tasks with explicit scheduled times on this day
            for (const scheduledTask of scheduledTasks) {
                const taskDate = new Date(scheduledTask.scheduledStart);
                if (taskDate.toDateString() === date.toDateString()) {
                    this.blockTimeSlot(slots, scheduledTask.scheduledStart, scheduledTask.scheduledEnd);
                }
            }

            allSlots.push({ date, slots });
        }

        // Auto-schedule tasks in available slots
        const now = new Date();
        for (const task of sortedAutoTasks) {
            const duration = task.duration || this.defaultDuration;
            const durationMs = duration * 60 * 1000;

            let scheduled = false;

            // Try to schedule in available slots
            for (const { date, slots } of allSlots) {
                // Skip days before start date
                if (task.startDate && date < task.startDate) continue;

                // Skip days after due date
                if (task.dueDate && date > task.dueDate) continue;

                for (const slot of slots) {
                    if (!slot.available) continue;

                    // Skip time slots that are in the past
                    if (slot.end <= now) continue;

                    // If slot starts in the past but ends in the future, adjust the start time
                    const effectiveStart = slot.start < now ? now : slot.start;
                    const slotDuration = slot.end.getTime() - effectiveStart.getTime();

                    if (slotDuration >= durationMs) {
                        // Found a suitable slot
                        const scheduledStart = new Date(effectiveStart);
                        const scheduledEnd = new Date(scheduledStart.getTime() + durationMs);

                        scheduledTasks.push({
                            ...task,
                            scheduledStart,
                            scheduledEnd
                        });

                        // Mark this time as used by adjusting the slot
                        slot.start = scheduledEnd;
                        if (slot.start >= slot.end) {
                            slot.available = false;
                        }

                        scheduled = true;
                        break;
                    }
                }

                if (scheduled) break;
            }
        }

        return scheduledTasks;
    }

    /**
     * Block out a time slot from the available slots (for tasks with explicit scheduled times)
     */
    private blockTimeSlot(slots: TimeSlot[], blockStart: Date, blockEnd: Date): void {
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (!slot.available) continue;

            const slotStart = slot.start.getTime();
            const slotEnd = slot.end.getTime();
            const blockStartMs = blockStart.getTime();
            const blockEndMs = blockEnd.getTime();

            // Check if the block overlaps with this slot
            if (blockEndMs <= slotStart || blockStartMs >= slotEnd) {
                // No overlap
                continue;
            }

            // Block overlaps with slot - need to split or mark unavailable
            if (blockStartMs <= slotStart && blockEndMs >= slotEnd) {
                // Block completely covers slot
                slot.available = false;
            } else if (blockStartMs > slotStart && blockEndMs < slotEnd) {
                // Block is in the middle - split into two slots
                const beforeSlot: TimeSlot = {
                    start: new Date(slotStart),
                    end: new Date(blockStartMs),
                    available: true
                };
                const afterSlot: TimeSlot = {
                    start: new Date(blockEndMs),
                    end: new Date(slotEnd),
                    available: true
                };
                slots.splice(i, 1, beforeSlot, afterSlot);
                i++; // Skip the after slot we just added
            } else if (blockStartMs <= slotStart) {
                // Block overlaps start of slot
                slot.start = new Date(blockEndMs);
                if (slot.start >= slot.end) {
                    slot.available = false;
                }
            } else {
                // Block overlaps end of slot
                slot.end = new Date(blockStartMs);
                if (slot.start >= slot.end) {
                    slot.available = false;
                }
            }
        }
    }

    /**
     * Parse tasks from markdown checkboxes (legacy format)
     */
    parseTasksFromMarkdown(markdown: string): Task[] {
        const tasks: Task[] = [];
        const lines = markdown.split('\n');

        for (const line of lines) {
            // Match uncompleted tasks: - [ ] or * [ ]
            const taskMatch = line.match(/^[\s]*[-*]\s+\[\s\]\s+(.+)$/);
            if (!taskMatch) continue;

            const taskText = taskMatch[1];

            // Extract priority (default to 3 - medium)
            let priority = 3;
            const priorityMatch = taskText.match(/\[p(\d)\]/i);
            if (priorityMatch) {
                priority = parseInt(priorityMatch[1]);
            }

            // Extract duration
            let duration: number | undefined;
            const durationMatch = taskText.match(/(\d+)\s*min/i);
            if (durationMatch) {
                duration = parseInt(durationMatch[1]);
            }

            // Extract due date
            let dueDate: Date | undefined;
            const dueDateMatch = taskText.match(/due:\s*(\d{4}-\d{2}-\d{2})/i);
            if (dueDateMatch) {
                dueDate = new Date(dueDateMatch[1]);
            }

            // Clean title (remove metadata)
            let title = taskText
                .replace(/\[p\d\]/gi, '')
                .replace(/\d+\s*min/gi, '')
                .replace(/due:\s*\d{4}-\d{2}-\d{2}/gi, '')
                .trim();

            tasks.push({
                title,
                priority,
                duration,
                dueDate
            });
        }

        return tasks;
    }

    /**
     * Parse tasks from Obsidian Tasks plugin format
     * Supports emojis: 📅 scheduled, ⏳ due, ⏫🔺🔼🔽 priority, 🔁 recurring, #tags
     */
    parseTasksPluginFormat(markdown: string, filePath?: string): Task[] {
        const tasks: Task[] = [];
        const lines = markdown.split('\n');

        for (const line of lines) {
            // Match uncompleted tasks: - [ ] or * [ ]
            const taskMatch = line.match(/^[\s]*[-*]\s+\[\s\]\s+(.+)$/);
            if (!taskMatch) continue;

            const taskText = taskMatch[1];

            // Extract title (everything before emojis and metadata)
            let title = taskText;

            // Extract scheduled date (📅 YYYY-MM-DD HH:mm or 📅 YYYY-MM-DD)
            let scheduledDate: Date | undefined;
            const scheduledMatch = taskText.match(/📅\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}):(\d{2}))?/);
            if (scheduledMatch) {
                if (scheduledMatch[2] && scheduledMatch[3]) {
                    // Has time
                    scheduledDate = new Date(`${scheduledMatch[1]}T${scheduledMatch[2]}:${scheduledMatch[3]}:00`);
                } else {
                    // No time - just date
                    scheduledDate = new Date(scheduledMatch[1]);
                }
            }

            // Extract start date (🛫 YYYY-MM-DD)
            let startDate: Date | undefined;
            const startMatch = taskText.match(/🛫\s*(\d{4}-\d{2}-\d{2})/);
            if (startMatch) {
                startDate = new Date(startMatch[1]);
            }

            // Extract due date (⏳ YYYY-MM-DD or 📆 YYYY-MM-DD)
            let dueDate: Date | undefined;
            const dueMatch = taskText.match(/[⏳📆]\s*(\d{4}-\d{2}-\d{2})/);
            if (dueMatch) {
                dueDate = new Date(dueMatch[1]);
            }

            // Extract priority from emoji (⏫=1, 🔺=2, 🔼=3, default=3, 🔽=4, ⏬=5)
            let priority = 3;
            if (taskText.includes('⏫')) priority = 1;
            else if (taskText.includes('🔺')) priority = 2;
            else if (taskText.includes('🔼')) priority = 3;
            else if (taskText.includes('🔽')) priority = 4;
            else if (taskText.includes('⏬')) priority = 5;

            // Check if recurring
            const isRecurring = taskText.includes('🔁');

            // Extract tags (#tag)
            const tags: string[] = [];
            const tagRegex = /#([^\s#]+)/g;
            let tagMatch;
            while ((tagMatch = tagRegex.exec(taskText)) !== null) {
                tags.push(tagMatch[1]);
            }

            // Extract duration from tag or text (e.g., #duration/30min or "30 min")
            let duration: number | undefined;
            const durationTagMatch = taskText.match(/#duration\/(\d+)(?:min)?/i);
            const durationTextMatch = taskText.match(/(\d+)\s*min/i);
            if (durationTagMatch) {
                duration = parseInt(durationTagMatch[1]);
            } else if (durationTextMatch) {
                duration = parseInt(durationTextMatch[1]);
            }

            // Clean title - remove all metadata
            title = taskText
                .replace(/📅\s*\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/g, '')
                .replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, '')
                .replace(/[⏳📆]\s*\d{4}-\d{2}-\d{2}/g, '')
                .replace(/[⏫🔺🔼🔽⏬]/g, '')
                .replace(/🔁/g, '')
                .replace(/#\S+/g, '')
                .replace(/\d+\s*min/gi, '')
                .trim();

            tasks.push({
                title,
                priority,
                duration,
                dueDate,
                scheduledDate,
                startDate,
                isRecurring,
                tags: tags.length > 0 ? tags : undefined,
                filePath
            });
        }

        return tasks;
    }

    /**
     * Parse tasks from multiple formats (legacy + Tasks plugin)
     */
    parseAllTasks(markdown: string, filePath?: string): Task[] {
        // Try Tasks plugin format first
        const tasksPluginTasks = this.parseTasksPluginFormat(markdown, filePath);

        // Try legacy format
        const legacyTasks = this.parseTasksFromMarkdown(markdown);

        // Combine, preferring Tasks plugin format if both match the same line
        const combined = [...tasksPluginTasks];

        // Add legacy tasks that aren't already in tasksPluginTasks
        for (const legacyTask of legacyTasks) {
            const isDuplicate = tasksPluginTasks.some(t => t.title === legacyTask.title);
            if (!isDuplicate) {
                combined.push(legacyTask);
            }
        }

        return combined;
    }
}
