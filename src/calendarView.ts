import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import type { CalendarService } from './calendarService';
import type { TaskScheduler, ScheduledTask } from './taskScheduler';
import type { CalendarEvent } from './types';

export const VIEW_TYPE_CALENDAR = 'blockhead-calendar-view';

type ViewMode = 'day' | 'week' | 'agenda';

export class CalendarView extends ItemView {
    private calendarService: CalendarService;
    private taskScheduler: TaskScheduler;
    private refreshInterval: number | null = null;
    private currentViewMode: ViewMode = 'day';
    private currentDate: Date = new Date();
    private scheduledTasks: ScheduledTask[] = [];
    private debounceTimer: number | null = null;

    constructor(leaf: WorkspaceLeaf, calendarService: CalendarService, taskScheduler: TaskScheduler) {
        super(leaf);
        this.calendarService = calendarService;
        this.taskScheduler = taskScheduler;
    }

    getViewType(): string {
        return VIEW_TYPE_CALENDAR;
    }

    getDisplayText(): string {
        return 'Calendar';
    }

    getIcon(): string {
        return 'calendar';
    }

    async onOpen(): Promise<void> {
        await this.renderView();

        // Auto-refresh every 5 minutes for calendar events
        this.refreshInterval = window.setInterval(async () => {
            await this.renderView();
        }, 5 * 60 * 1000);

        // Watch for file changes to detect task completion/modification
        this.registerEvent(
            this.app.vault.on('modify', async (file: TFile) => {
                // Only react to markdown files
                if (file.extension === 'md') {
                    // Debounce to avoid too many refreshes during rapid edits
                    if (this.debounceTimer) {
                        window.clearTimeout(this.debounceTimer);
                    }
                    this.debounceTimer = window.setTimeout(async () => {
                        await this.renderView();
                    }, 500); // Wait 500ms after last change
                }
            })
        );
    }

    async onClose(): Promise<void> {
        if (this.refreshInterval) {
            window.clearInterval(this.refreshInterval);
        }
        if (this.debounceTimer) {
            window.clearTimeout(this.debounceTimer);
        }
        // Event handlers are automatically unregistered via registerEvent
    }

    async renderView(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('calendar-container');

        // Add header
        this.renderHeader(container);

        // Add view mode tabs
        this.renderViewTabs(container);

        // Add navigation
        this.renderNavigation(container);

        // Add loading indicator
        const loadingEl = container.createEl('div', {
            text: 'Loading calendar and tasks...',
            cls: 'calendar-loading'
        });

        try {
            const days = this.currentViewMode === 'week' ? 7 : this.currentViewMode === 'day' ? 1 : 30;
            const events = await this.calendarService.getCalendarEvents(days);

            // Load and schedule tasks from all markdown files
            await this.loadAndScheduleTasks(events);

            loadingEl.remove();

            // Render based on current view mode
            if (this.currentViewMode === 'day') {
                this.renderDayView(container, events);
            } else if (this.currentViewMode === 'week') {
                this.renderWeekView(container, events);
            } else {
                this.renderAgendaView(container, events);
            }

        } catch (error) {
            loadingEl.remove();
            container.createEl('div', {
                text: `Error loading calendar: ${error.message}`,
                cls: 'calendar-error'
            });
            console.error('Calendar error:', error);
        }
    }

    /**
     * Load tasks from all markdown files and schedule them
     *
     * This method:
     * 1. Scans all markdown files for unchecked tasks (- [ ])
     * 2. Automatically excludes completed tasks (- [x])
     * 3. Schedules remaining tasks by priority and due date
     * 4. Fills available time slots between calendar events
     *
     * Called whenever:
     * - View is opened or refreshed
     * - Any markdown file is modified (with 500ms debounce)
     * - Every 5 minutes (auto-refresh)
     */
    private async loadAndScheduleTasks(events: CalendarEvent[]): Promise<void> {
        const allTasks: any[] = [];
        const markdownFiles = this.app.vault.getMarkdownFiles();

        // Parse tasks from all markdown files
        // Only unchecked tasks (- [ ]) are parsed; completed tasks (- [x]) are ignored
        for (const file of markdownFiles) {
            try {
                const content = await this.app.vault.read(file);
                const tasks = this.taskScheduler.parseAllTasks(content, file.path);
                allTasks.push(...tasks);
            } catch (error) {
                console.error(`Error reading file ${file.path}:`, error);
            }
        }

        // Schedule the tasks with automatic reprioritization
        // Tasks are sorted by priority (1=highest) and due date, then scheduled in available slots
        if (allTasks.length > 0) {
            this.scheduledTasks = this.taskScheduler.scheduleTasks(
                allTasks,
                events,
                new Date(),
                30 // Schedule up to 30 days ahead
            );
        } else {
            this.scheduledTasks = [];
        }
    }

    private renderHeader(container: HTMLElement): void {
        const header = container.createEl('div', { cls: 'calendar-header' });
        header.createEl('h4', { text: 'Your Calendar' });

        const refreshBtn = header.createEl('button', {
            text: '↻',
            cls: 'calendar-refresh-btn'
        });
        refreshBtn.addEventListener('click', async () => {
            await this.renderView();
            new Notice('Calendar refreshed');
        });
    }

    private renderViewTabs(container: HTMLElement): void {
        const tabsContainer = container.createEl('div', { cls: 'calendar-view-tabs' });

        const views: { mode: ViewMode; label: string }[] = [
            { mode: 'day', label: 'Day' },
            { mode: 'week', label: 'Week' },
            { mode: 'agenda', label: 'Agenda' }
        ];

        for (const view of views) {
            const tab = tabsContainer.createEl('button', {
                text: view.label,
                cls: 'calendar-view-tab'
            });

            if (this.currentViewMode === view.mode) {
                tab.addClass('active');
            }

            tab.addEventListener('click', async () => {
                this.currentViewMode = view.mode;
                await this.renderView();
            });
        }
    }

    private renderNavigation(container: HTMLElement): void {
        const nav = container.createEl('div', { cls: 'calendar-navigation' });

        const prevBtn = nav.createEl('button', {
            text: '‹',
            cls: 'calendar-nav-btn'
        });
        prevBtn.addEventListener('click', async () => {
            if (this.currentViewMode === 'day') {
                this.currentDate.setDate(this.currentDate.getDate() - 1);
            } else if (this.currentViewMode === 'week') {
                this.currentDate.setDate(this.currentDate.getDate() - 7);
            }
            await this.renderView();
        });

        const dateLabel = nav.createEl('div', {
            text: this.getDateLabel(),
            cls: 'calendar-date-label'
        });

        const todayBtn = nav.createEl('button', {
            text: 'Today',
            cls: 'calendar-today-btn'
        });
        todayBtn.addEventListener('click', async () => {
            this.currentDate = new Date();
            await this.renderView();
        });

        const nextBtn = nav.createEl('button', {
            text: '›',
            cls: 'calendar-nav-btn'
        });
        nextBtn.addEventListener('click', async () => {
            if (this.currentViewMode === 'day') {
                this.currentDate.setDate(this.currentDate.getDate() + 1);
            } else if (this.currentViewMode === 'week') {
                this.currentDate.setDate(this.currentDate.getDate() + 7);
            }
            await this.renderView();
        });
    }

    private getDateLabel(): string {
        const today = new Date();
        const isToday = this.currentDate.toDateString() === today.toDateString();

        if (this.currentViewMode === 'day') {
            return isToday ? 'Today' : this.currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        } else if (this.currentViewMode === 'week') {
            const weekStart = this.getWeekStart(this.currentDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            return 'Upcoming Events';
        }
    }

    private renderDayView(container: HTMLElement, allEvents: CalendarEvent[]): void {
        const dayContent = container.createEl('div', { cls: 'calendar-day-view' });

        // Filter events for current day
        const dayEvents = allEvents.filter(event => {
            const eventDate = new Date(event.start.dateTime);
            return eventDate.toDateString() === this.currentDate.toDateString();
        });

        // Filter tasks for current day
        const dayTasks = this.scheduledTasks.filter(task => {
            const taskDate = new Date(task.scheduledStart);
            return taskDate.toDateString() === this.currentDate.toDateString();
        });

        if (dayEvents.length === 0 && dayTasks.length === 0) {
            dayContent.createEl('div', {
                text: 'No events or tasks scheduled for this day',
                cls: 'calendar-no-events'
            });
            return;
        }

        // Create timeline with both events and tasks
        const timeline = dayContent.createEl('div', { cls: 'calendar-timeline' });

        // Combine and sort by start time
        const items: Array<{ type: 'event' | 'task', data: CalendarEvent | ScheduledTask, start: Date }> = [
            ...dayEvents.map(e => ({ type: 'event' as const, data: e, start: new Date(e.start.dateTime) })),
            ...dayTasks.map(t => ({ type: 'task' as const, data: t, start: new Date(t.scheduledStart) }))
        ];

        items.sort((a, b) => a.start.getTime() - b.start.getTime());

        for (const item of items) {
            if (item.type === 'event') {
                this.renderTimelineEvent(timeline, item.data as CalendarEvent);
            } else {
                this.renderTimelineTask(timeline, item.data as ScheduledTask);
            }
        }
    }

    private renderWeekView(container: HTMLElement, allEvents: CalendarEvent[]): void {
        const weekContent = container.createEl('div', { cls: 'calendar-week-view' });
        const weekStart = this.getWeekStart(this.currentDate);

        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + i);

            const dayColumn = weekContent.createEl('div', { cls: 'calendar-week-day' });

            // Day header
            const dayHeader = dayColumn.createEl('div', { cls: 'calendar-week-day-header' });
            const today = new Date();
            const isToday = day.toDateString() === today.toDateString();

            if (isToday) {
                dayHeader.addClass('today');
            }

            dayHeader.createEl('div', {
                text: day.toLocaleDateString('en-US', { weekday: 'short' }),
                cls: 'calendar-week-day-name'
            });
            dayHeader.createEl('div', {
                text: day.getDate().toString(),
                cls: 'calendar-week-day-number'
            });

            // Day events
            const dayEvents = allEvents.filter(event => {
                const eventDate = new Date(event.start.dateTime);
                return eventDate.toDateString() === day.toDateString();
            });

            // Day tasks
            const dayTasks = this.scheduledTasks.filter(task => {
                const taskDate = new Date(task.scheduledStart);
                return taskDate.toDateString() === day.toDateString();
            });

            const itemsContainer = dayColumn.createEl('div', { cls: 'calendar-week-day-events' });

            if (dayEvents.length === 0 && dayTasks.length === 0) {
                itemsContainer.createEl('div', {
                    text: 'No items',
                    cls: 'calendar-no-events-small'
                });
            } else {
                // Combine and sort by start time
                const items: Array<{ type: 'event' | 'task', data: CalendarEvent | ScheduledTask, start: Date }> = [
                    ...dayEvents.map(e => ({ type: 'event' as const, data: e, start: new Date(e.start.dateTime) })),
                    ...dayTasks.map(t => ({ type: 'task' as const, data: t, start: new Date(t.scheduledStart) }))
                ];

                items.sort((a, b) => a.start.getTime() - b.start.getTime());

                for (const item of items) {
                    if (item.type === 'event') {
                        this.renderWeekEvent(itemsContainer, item.data as CalendarEvent);
                    } else {
                        this.renderWeekTask(itemsContainer, item.data as ScheduledTask);
                    }
                }
            }
        }
    }

    private renderAgendaView(container: HTMLElement, events: CalendarEvent[]): void {
        const agendaContent = container.createEl('div', { cls: 'calendar-agenda-view' });

        if (events.length === 0) {
            agendaContent.createEl('div', {
                text: 'No upcoming events',
                cls: 'calendar-no-events'
            });
            return;
        }

        // Group events by date
        const eventsByDate = this.groupEventsByDate(events);

        for (const [date, dateEvents] of eventsByDate) {
            const dateSection = agendaContent.createEl('div', { cls: 'calendar-date-section' });

            const dateHeader = dateSection.createEl('div', { cls: 'calendar-date-header' });
            dateHeader.createEl('h5', { text: this.formatDate(date) });

            const eventsList = dateSection.createEl('div', { cls: 'calendar-events-list' });

            for (const event of dateEvents) {
                this.renderAgendaEvent(eventsList, event);
            }
        }
    }

    private renderTimelineEvent(container: HTMLElement, event: CalendarEvent): void {
        const eventEl = container.createEl('div', { cls: 'calendar-timeline-event' });

        const startTime = new Date(event.start.dateTime);
        const endTime = new Date(event.end.dateTime);

        const timeEl = eventEl.createEl('div', {
            text: `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`,
            cls: 'calendar-event-time'
        });

        const titleEl = eventEl.createEl('div', {
            text: event.subject,
            cls: 'calendar-event-title'
        });

        if (event.location?.displayName) {
            const locationEl = eventEl.createEl('div', {
                cls: 'calendar-event-location'
            });
            locationEl.createEl('span', { text: '📍 ' });
            locationEl.createEl('span', { text: event.location.displayName });
        }
    }

    private renderTimelineTask(container: HTMLElement, task: ScheduledTask): void {
        const taskEl = container.createEl('div', { cls: 'calendar-timeline-task' });

        const startTime = new Date(task.scheduledStart);
        const endTime = new Date(task.scheduledEnd);

        const timeEl = taskEl.createEl('div', {
            text: `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`,
            cls: 'calendar-task-time'
        });

        const titleContainer = taskEl.createEl('div', { cls: 'calendar-task-title-container' });
        titleContainer.createEl('span', { text: '☑️ ', cls: 'calendar-task-icon' });
        titleContainer.createEl('span', { text: task.title, cls: 'calendar-task-title' });

        // Show priority indicator
        const priorityEmoji = this.getPriorityEmoji(task.priority);
        if (priorityEmoji) {
            taskEl.createEl('div', {
                text: `${priorityEmoji} Priority ${task.priority}`,
                cls: 'calendar-task-priority'
            });
        }

        // Show source file
        if (task.filePath) {
            const fileEl = taskEl.createEl('div', { cls: 'calendar-task-file' });
            fileEl.createEl('span', { text: '📄 ' });
            fileEl.createEl('span', { text: task.filePath.split('/').pop() || task.filePath });
        }
    }

    private renderWeekEvent(container: HTMLElement, event: CalendarEvent): void {
        const eventEl = container.createEl('div', { cls: 'calendar-week-event' });

        const startTime = new Date(event.start.dateTime);

        eventEl.createEl('div', {
            text: this.formatTime(startTime),
            cls: 'calendar-week-event-time'
        });

        eventEl.createEl('div', {
            text: event.subject,
            cls: 'calendar-week-event-title'
        });
    }

    private renderWeekTask(container: HTMLElement, task: ScheduledTask): void {
        const taskEl = container.createEl('div', { cls: 'calendar-week-task' });

        const startTime = new Date(task.scheduledStart);

        taskEl.createEl('div', {
            text: this.formatTime(startTime),
            cls: 'calendar-week-task-time'
        });

        const titleContainer = taskEl.createEl('div', { cls: 'calendar-week-task-title' });
        titleContainer.createEl('span', { text: '☑️ ' });
        titleContainer.createEl('span', { text: task.title });
    }

    private renderAgendaEvent(container: HTMLElement, event: CalendarEvent): void {
        const eventEl = container.createEl('div', { cls: 'calendar-event' });

        const startTime = new Date(event.start.dateTime);
        const endTime = new Date(event.end.dateTime);

        eventEl.createEl('div', {
            text: `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`,
            cls: 'calendar-event-time'
        });

        eventEl.createEl('div', {
            text: event.subject,
            cls: 'calendar-event-title'
        });

        if (event.location?.displayName) {
            const locationEl = eventEl.createEl('div', {
                cls: 'calendar-event-location'
            });
            locationEl.createEl('span', { text: '📍 ' });
            locationEl.createEl('span', { text: event.location.displayName });
        }

        if (event.bodyPreview && event.bodyPreview.trim()) {
            eventEl.createEl('div', {
                text: event.bodyPreview,
                cls: 'calendar-event-description'
            });
        }
    }

    private formatTime(date: Date): string {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    private getWeekStart(date: Date): Date {
        const start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day;
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    private groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
        const grouped = new Map<string, CalendarEvent[]>();

        for (const event of events) {
            const date = new Date(event.start.dateTime);
            const dateKey = date.toISOString().split('T')[0];

            if (!grouped.has(dateKey)) {
                grouped.set(dateKey, []);
            }
            grouped.get(dateKey)!.push(event);
        }

        return grouped;
    }

    private formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const isToday = date.toDateString() === today.toDateString();
        const isTomorrow = date.toDateString() === tomorrow.toDateString();

        if (isToday) {
            return '📅 Today';
        } else if (isTomorrow) {
            return '📅 Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    private getPriorityEmoji(priority: number): string {
        switch (priority) {
            case 1: return '⏫';
            case 2: return '🔺';
            case 3: return '🔼';
            case 4: return '🔽';
            case 5: return '⏬';
            default: return '';
        }
    }
}
