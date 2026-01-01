import { App, PluginSettingTab, Setting } from 'obsidian';
import type BlockheadCalendarPlugin from '../main';

export class BlockheadSettingTab extends PluginSettingTab {
    plugin: BlockheadCalendarPlugin;

    constructor(app: App, plugin: BlockheadCalendarPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Blockhead Calendar Settings' });

        containerEl.createEl('p', {
            text: 'Connect your calendar using an ICS URL from Outlook, Google Calendar, or other calendar service.',
            cls: 'setting-item-description'
        });

        const instructions = containerEl.createEl('div', { cls: 'setting-item-description' });
        instructions.createEl('h3', { text: 'Getting your ICS URL:' });

        const outlookSteps = instructions.createEl('div');
        outlookSteps.createEl('h4', { text: 'Outlook/Microsoft 365:' });
        const outlookList = outlookSteps.createEl('ol');
        outlookList.createEl('li', { text: 'Go to Outlook Calendar' });
        outlookList.createEl('li', { text: 'Click Settings → View all Outlook settings' });
        outlookList.createEl('li', { text: 'Go to Calendar → Shared calendars' });
        outlookList.createEl('li', { text: 'Under "Publish a calendar", select your calendar and click "ICS"' });
        outlookList.createEl('li', { text: 'Copy the ICS link' });

        const googleSteps = instructions.createEl('div');
        googleSteps.createEl('h4', { text: 'Google Calendar:' });
        const googleList = googleSteps.createEl('ol');
        googleList.createEl('li', { text: 'Go to Google Calendar settings' });
        googleList.createEl('li', { text: 'Click on your calendar name' });
        googleList.createEl('li', { text: 'Scroll to "Integrate calendar"' });
        googleList.createEl('li', { text: 'Copy the "Secret address in iCal format" URL' });

        new Setting(containerEl)
            .setName('Calendar ICS URL')
            .setDesc('The ICS/iCal feed URL from your calendar provider')
            .addText(text => text
                .setPlaceholder('https://outlook.office365.com/owa/calendar/...')
                .setValue(this.plugin.settings.icsUrl)
                .onChange(async (value) => {
                    this.plugin.settings.icsUrl = value;
                    await this.plugin.saveSettings();
                    this.plugin.calendarService.updateIcsUrl(value);
                }));

        containerEl.createEl('h3', { text: 'Task Scheduling Settings' });

        new Setting(containerEl)
            .setName('Default Task Duration')
            .setDesc('Default length for tasks without a specified duration (in minutes)')
            .addText(text => text
                .setPlaceholder('30')
                .setValue(String(this.plugin.settings.defaultTaskDuration))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.defaultTaskDuration = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Work Start Hour')
            .setDesc('Start of work day (24-hour format)')
            .addText(text => text
                .setPlaceholder('9')
                .setValue(String(this.plugin.settings.workStartHour))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0 && num < 24) {
                        this.plugin.settings.workStartHour = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Work End Hour')
            .setDesc('End of work day (24-hour format)')
            .addText(text => text
                .setPlaceholder('17')
                .setValue(String(this.plugin.settings.workEndHour))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0 && num < 24) {
                        this.plugin.settings.workEndHour = num;
                        await this.plugin.saveSettings();
                    }
                }));

        containerEl.createEl('h3', { text: 'Task Format' });
        const formatInfo = containerEl.createEl('div', { cls: 'setting-item-description' });
        formatInfo.createEl('p', { text: 'Use these formats in your task checkboxes:' });
        const formatList = formatInfo.createEl('ul');
        formatList.createEl('li', { text: '[p1] to [p5] - Priority (1=highest)' });
        formatList.createEl('li', { text: '30 min - Task duration' });
        formatList.createEl('li', { text: 'due: 2026-01-15 - Due date' });

        const exampleDiv = containerEl.createEl('div', { cls: 'setting-item-description' });
        exampleDiv.createEl('p', { text: 'Example:' });
        const exampleCode = exampleDiv.createEl('pre');
        exampleCode.createEl('code', { text: '- [ ] Complete report [p1] 60 min due: 2026-01-05\n- [ ] Review documents [p3]\n- [ ] Team meeting prep [p2] 15 min' });
    }
}
