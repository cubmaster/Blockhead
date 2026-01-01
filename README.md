# Blockhead Calendar Plugin

An Obsidian plugin that displays your calendar events and intelligently schedules tasks based on priority.

## Features

- **📅 Calendar View**: Day, Week, and Agenda views showing your schedule
- **🔗 ICS Integration**: No authentication needed - just paste your calendar's ICS URL
- **🤖 Smart Task Scheduling**: Automatically schedule tasks in available time slots
- **⚡ Priority-Based**: Tasks scheduled by priority (p1-p5) and due dates
- **⏱️ Auto-Refresh**: Calendar updates every 5 minutes
- **📝 Daily Notes Integration**: Insert events directly into your notes

## Quick Setup

### 1. Get Your Calendar ICS URL

**Outlook/Microsoft 365:**
1. Go to Outlook Calendar
2. Settings → View all Outlook settings
3. Calendar → Shared calendars
4. Publish a calendar → Select calendar → Click "ICS"
5. Copy the ICS link

**Google Calendar:**
1. Go to Google Calendar settings
2. Click on your calendar name
3. Scroll to "Integrate calendar"
4. Copy the "Secret address in iCal format"

### 2. Configure Plugin

1. In Obsidian Settings → Blockhead Calendar
2. Paste your ICS URL
3. Adjust task scheduling preferences:
   - Default task duration (default: 30 minutes)
   - Work hours (default: 9 AM - 5 PM)

## Usage

### View Your Calendar

- Click the calendar icon in the ribbon
- Or use Command Palette: "Open Calendar View"
- Switch between Day, Week, and Agenda views

### Schedule Tasks

Write tasks in your notes using checkboxes. The plugin supports two formats:

**Standard Format:**
```markdown
## My Tasks

- [ ] Complete project report [p1] 60 min due: 2026-01-10
- [ ] Review pull requests [p2] 30 min
- [ ] Team standup prep [p3] 15 min
- [ ] Update documentation [p4]
```

- `[p1]` to `[p5]` - Priority (1 = highest)
- `30 min` - Duration in minutes
- `due: 2026-01-15` - Due date

**Obsidian Tasks Plugin Format:**
```markdown
## My Tasks

- [ ] Complete project report ⏫ 📅 2026-01-03 09:00 ⏳ 2026-01-10
- [ ] Review pull requests 🔺 30 min
- [ ] Team standup prep 🔼
- [ ] Update documentation
```

- `⏫` = Priority 1 (highest), `🔺` = Priority 2, `🔼` = Priority 3, `🔽` = Priority 4, `⏬` = Priority 5
- `📅 YYYY-MM-DD HH:mm` - Scheduled date/time
- `⏳ YYYY-MM-DD` or `📆 YYYY-MM-DD` - Due date
- `🛫 YYYY-MM-DD` - Start date
- `🔁` - Recurring task
- `#tags` - Task tags

**Automatic Scheduling:**
- Tasks with scheduled times (📅) are placed at specific times
- Tasks without scheduled times are auto-scheduled in next available 30-minute slots by priority
- All tasks appear as blocks on the calendar alongside your events
- The calendar automatically scans all markdown files for tasks

**To Schedule Manually:**
1. Write your tasks in a note
2. Command Palette: "Schedule Tasks from Current Note"
3. Plugin finds available time slots and schedules tasks by priority

### Insert Today's Events

1. Open your daily note
2. Command Palette: "Insert Today's Events"
3. Events are added in markdown format

## How Task Scheduling Works

1. **Parses Tasks**: Reads checkboxes from your current note
2. **Finds Free Time**: Analyzes your calendar to find available slots
3. **Prioritizes**: Schedules high-priority tasks first
4. **Respects Due Dates**: Won't schedule tasks after their due date
5. **Smart Blocking**: Fills available time between meetings

Example output:

```markdown
## Scheduled Tasks

- [ ] **Complete project report**
  - Scheduled: Wed, Jan 3, 9:00 AM - 10:00 AM
  - Priority: 1
  - Due: 1/10/2026

- [ ] **Review pull requests**
  - Scheduled: Wed, Jan 3, 10:30 AM - 11:00 AM
  - Priority: 2
```

## Settings

- **Calendar ICS URL**: Your calendar feed URL
- **Default Task Duration**: Length for tasks without specified duration (minutes)
- **Work Start Hour**: Beginning of workday (24-hour format)
- **Work End Hour**: End of workday (24-hour format)

## Privacy & Security

- ✅ No authentication required
- ✅ No Microsoft/Google login
- ✅ ICS URLs are private and encrypted
- ✅ All data stays local
- ✅ Calendar refreshes automatically every 5 minutes

## Tips

1. **Keep your ICS URL private** - it provides read access to your calendar
2. **Use priorities wisely** - p1 for urgent, p5 for low priority
3. **Set realistic durations** - helps the scheduler find appropriate slots
4. **Check scheduled tasks** - adjust if needed based on your preferences

## Troubleshooting

### Calendar not loading
- Check that your ICS URL is correct and accessible
- Try pasting the URL in a browser to verify it works
- Click the Refresh button in the calendar view

### Tasks not scheduling
- Make sure you have tasks in checkbox format
- Verify there's available time in your calendar
- Check that work hours are set correctly

### No events showing
- Verify your ICS URL is correct
- Make sure your calendar has events
- Check that you're looking at the right date range

## Development

```bash
npm install
npm run build
```

## License

MIT
