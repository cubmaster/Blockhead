import { Plugin, WorkspaceLeaf, Editor, MarkdownView } from 'obsidian';
import { CalendarView, VIEW_TYPE_CALENDAR } from './src/calendarView';
import { CalendarService } from './src/calendarService';
import { TaskScheduler } from './src/taskScheduler';
import { BlockheadSettingTab } from './src/settingsTab';
import { BlockheadSettings, DEFAULT_SETTINGS } from './src/types';

export default class BlockheadCalendarPlugin extends Plugin {
    settings: BlockheadSettings;
    calendarService: CalendarService;
    taskScheduler: TaskScheduler;

    async onload() {
        await this.loadSettings();

        // Initialize services
        this.calendarService = new CalendarService(this.settings.icsUrl);
        this.taskScheduler = new TaskScheduler(
            this.settings.defaultTaskDuration,
            this.settings.workStartHour,
            this.settings.workEndHour
        );

        // Register the calendar view
        this.registerView(
            VIEW_TYPE_CALENDAR,
            (leaf) => new CalendarView(leaf, this.calendarService, this.taskScheduler)
        );

        // Add ribbon icon to open calendar view
        this.addRibbonIcon('calendar', 'Open Calendar', async () => {
            await this.activateView();
        });

        // Add command to open calendar view
        this.addCommand({
            id: 'open-calendar-view',
            name: 'Open Calendar View',
            callback: async () => {
                await this.activateView();
            }
        });

        // Add command to insert today's events into current note
        this.addCommand({
            id: 'insert-todays-events',
            name: 'Insert Today\'s Events',
            editorCallback: async (editor) => {
                try {
                    const events = await this.calendarService.getTodayEvents();

                    if (events.length === 0) {
                        editor.replaceSelection('No events scheduled for today.\n');
                        return;
                    }

                    let text = '## Today\'s Calendar\n\n';
                    for (const event of events) {
                        text += this.calendarService.formatEventForNote(event);
                    }

                    editor.replaceSelection(text);
                } catch (error) {
                    console.error('Failed to insert events:', error);
                    editor.replaceSelection(`Failed to fetch calendar events: ${error.message}\n`);
                }
            }
        });

        // Add command to schedule tasks
        this.addCommand({
            id: 'schedule-tasks',
            name: 'Schedule Tasks from Current Note',
            editorCallback: async (editor, view: MarkdownView) => {
                try {
                    const content = editor.getValue();
                    const filePath = view.file?.path;
                    const tasks = this.taskScheduler.parseAllTasks(content, filePath);

                    if (tasks.length === 0) {
                        editor.replaceSelection('\n\nNo tasks found. Use checkboxes with priority, duration, and due dates.\n');
                        return;
                    }

                    const events = await this.calendarService.getCalendarEvents(7);
                    const scheduledTasks = this.taskScheduler.scheduleTasks(tasks, events, new Date(), 7);

                    let text = '\n\n## Scheduled Tasks\n\n';
                    for (const task of scheduledTasks) {
                        const startTime = task.scheduledStart.toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });
                        const endTime = task.scheduledEnd.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });

                        text += `- [ ] **${task.title}**\n`;
                        text += `  - Scheduled: ${startTime} - ${endTime}\n`;
                        text += `  - Priority: ${task.priority}\n`;
                        if (task.dueDate) {
                            text += `  - Due: ${task.dueDate.toLocaleDateString()}\n`;
                        }
                        text += '\n';
                    }

                    const unscheduled = tasks.length - scheduledTasks.length;
                    if (unscheduled > 0) {
                        text += `\n*Note: ${unscheduled} task(s) could not be scheduled in available time slots.*\n`;
                    }

                    editor.replaceSelection(text);
                } catch (error) {
                    console.error('Failed to schedule tasks:', error);
                    editor.replaceSelection(`\n\nFailed to schedule tasks: ${error.message}\n`);
                }
            }
        });

        // Add settings tab
        this.addSettingTab(new BlockheadSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

        if (leaves.length > 0) {
            // View already exists, reveal it
            leaf = leaves[0];
        } else {
            // Create new view in right sidebar
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({
                    type: VIEW_TYPE_CALENDAR,
                    active: true
                });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    onunload() {
        // Clean up
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);

        // Update services with new settings
        if (this.taskScheduler) {
            this.taskScheduler = new TaskScheduler(
                this.settings.defaultTaskDuration,
                this.settings.workStartHour,
                this.settings.workEndHour
            );
        }
    }
}
