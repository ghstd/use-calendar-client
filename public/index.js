'use strict';
const serverUrl = 'https://use-calendar-and-notes.onrender.com';
let useCalendarKey = '';
const savedKey = window.localStorage.getItem('useCalendarKey');
if (savedKey) {
    useCalendarKey = savedKey;
}
function renderTimeScale() {
    const timeScaleRoot = document.querySelector('.scale__time');
    const timeNumsElements = [];
    timeScaleRoot.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const el = document.createElement('div');
        el.classList.add('time-item');
        el.textContent = `${i < 10 ? '0' + i : i}:00`;
        el.dataset.time = `${i}`;
        timeNumsElements.push(el);
        const subEl = document.createElement('div');
        subEl.classList.add('time-subitem');
        subEl.innerHTML = '<div>-</div><div>-</div><div>-</div>';
        subEl.dataset.time = `${i + 0.5}`;
        timeNumsElements.push(subEl);
    }
    timeScaleRoot.append(...timeNumsElements);
    timeScaleRoot.parentElement.scrollTop = timeScaleRoot.parentElement.scrollHeight / 10 * 2.5;
}
function createSpinner() {
    return `
	<div class="spinner">
		<div class="spinner-box swing">
			<div class="spin-horizontal"></div>
			<div class="spin-center"></div>
			<div class="rect-1 spin-1">
				<div class="sircle-1"></div>
			</div>
			<div class="rect-2 spin-2">
				<div class="sircle-2"></div>
			</div>
		</div>
	</div>
	`;
}
async function getBufferFromServer(date) {
    const response = await fetch(`${serverUrl}/notes?${date}`, {
        method: 'GET',
        headers: {
            'Content-type': 'application/json',
            'usecalendarkey': useCalendarKey
        },
        credentials: 'include'
    });
    return await response.json();
}
async function saveBufferToServer(buffer, date) {
    const response = await fetch(`${serverUrl}/notes?${date}`, {
        method: 'POST',
        headers: {
            'Content-type': 'application/json',
            'usecalendarkey': useCalendarKey
        },
        credentials: 'include',
        body: JSON.stringify(buffer)
    });
    return await response.json();
}
function renderBuffer(buffer, date) {
    const timeScaleRoot = document.querySelector('.scale__time');
    const notesRoot = document.querySelector('.notes__body');
    const diagramsRoot = document.querySelector('.scale__lines');
    const addingBtn = document.querySelector('.add');
    const notesDate = document.querySelector('.notes__date');
    function _renderNotes(noteData) {
        const noteElement = document.createElement('div');
        const text = document.createElement('div');
        const timeStart = document.createElement('input');
        const timeEnd = document.createElement('input');
        const saveBtn = document.createElement('button');
        const deleteBtn = document.createElement('button');
        const importantBtn = document.createElement('button');
        noteElement.classList.add('note');
        text.classList.add('text');
        text.setAttribute('contenteditable', 'true');
        text.textContent = noteData.text;
        text.onfocus = () => {
            saveBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
        };
        timeStart.classList.add('time-start');
        timeStart.setAttribute('type', 'time');
        timeStart.value = noteData.timeStart;
        timeStart.onfocus = () => {
            saveBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
        };
        timeEnd.classList.add('time-end');
        timeEnd.setAttribute('type', 'time');
        timeEnd.value = noteData.timeEnd;
        timeEnd.onfocus = () => {
            saveBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
        };
        saveBtn.classList.add('save-btn', 'hidden');
        saveBtn.textContent = 'save';
        saveBtn.onclick = () => {
            noteData.timeStart = timeStart.value;
            noteData.timeEnd = timeEnd.value;
            noteData.text = text.textContent;
            saveBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');
            _renderDiagrams();
            saveBufferToServer(buffer, date)
                .then((response) => {
                if (response.status) {
                    login().then(() => init());
                    return;
                }
                renderImportantNotes();
                renderWeekTasks();
            });
        };
        deleteBtn.classList.add('delete-btn', 'hidden');
        deleteBtn.textContent = 'x';
        deleteBtn.onclick = () => {
            buffer.notes.splice(buffer.notes.findIndex(item => item === noteData), 1);
            noteElement.remove();
            _renderDiagrams();
            saveBufferToServer(buffer, date)
                .then((response) => {
                if (response.status) {
                    login().then(() => init());
                    return;
                }
                renderImportantNotes();
                renderWeekTasks();
            });
        };
        importantBtn.classList.add('important-btn');
        if (noteData.important)
            importantBtn.classList.add('active');
        importantBtn.onclick = () => {
            saveBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
            if (noteData.important) {
                delete noteData.important;
                importantBtn.classList.remove('active');
            }
            else {
                noteData.important = true;
                importantBtn.classList.add('active');
            }
        };
        noteElement.append(importantBtn, timeStart, timeEnd, text, saveBtn, deleteBtn);
        notesRoot.append(noteElement);
    }
    function _renderDiagrams() {
        //1
        if (!buffer.notes.length) {
            diagramsRoot.innerHTML = '';
            return;
        }
        const renderedNotesIndexes = [];
        const timeIntervals = buffer.notes.map(note => {
            const timeInterval = [''];
            if (!note.timeStart)
                return null;
            timeInterval[0] = note.timeStart;
            renderedNotesIndexes.push(buffer.notes.findIndex(item => item === note));
            if (note.timeEnd) {
                timeInterval[1] = note.timeEnd;
            }
            if (note.important) {
                timeInterval[2] = true;
            }
            return timeInterval;
        });
        const timeIntervalsFiltered = timeIntervals.filter(interval => !!interval);
        if (!timeIntervalsFiltered.length)
            return;
        //2
        const diagrams = [];
        function _prepareDiagrams(timeInterval) {
            function _getValueFromString(string) {
                const arr = string.split(':').map(subStr => parseInt(subStr));
                const value = arr[0] + (arr[1] > 0 ? 0.5 : 0);
                return value;
            }
            const timeNums = Array.from(timeScaleRoot.children);
            let importantIndicator = false;
            if (timeInterval[2]) {
                importantIndicator = true;
                timeInterval.pop();
            }
            const values = timeInterval.map(string => _getValueFromString(string)).filter(value => value);
            let topCoord;
            let bottomCoord;
            let height;
            if (values.length === 1) {
                const startEl = timeNums.find(el => el.dataset.time === `${values[0]}`);
                topCoord = startEl.offsetTop + startEl.offsetHeight / 2;
                bottomCoord = topCoord;
                height = 0;
            }
            else {
                const startEl = timeNums.find(el => el.dataset.time === `${values[0]}`);
                const endEl = timeNums.find(el => el.dataset.time === `${values[1]}`);
                topCoord = startEl.offsetTop + startEl.offsetHeight / 2;
                bottomCoord = endEl.offsetTop + endEl.offsetHeight / 2;
                height = bottomCoord - topCoord;
                if (height < 0)
                    return;
            }
            const line = {
                startCoord: topCoord,
                endCoord: bottomCoord,
                length: height,
                important: importantIndicator
            };
            diagrams.push(line);
        }
        timeIntervalsFiltered.forEach(timeInterval => _prepareDiagrams(timeInterval));
        diagrams.sort((a, b) => a.length - b.length);
        //3
        function _displayDiagrams() {
            diagramsRoot.innerHTML = '';
            const zIndexMax = 100;
            const maxWidth = diagramsRoot.clientWidth;
            const minWidth = diagramsRoot.clientWidth / diagrams.length > diagramsRoot.clientWidth / 5
                ? diagramsRoot.clientWidth / 5
                : diagramsRoot.clientWidth / diagrams.length;
            function _findCrossing(item, obj) {
                return (obj.startCoord > item.startCoord
                    && obj.startCoord < item.endCoord)
                    || (obj.endCoord > item.startCoord
                        && obj.endCoord < item.endCoord)
                    || (item.startCoord > obj.startCoord
                        && item.startCoord < obj.endCoord)
                    || (item.endCoord > obj.startCoord
                        && item.endCoord < obj.endCoord);
            }
            function _addHandlersToLine(line, i) {
                line.onmouseenter = () => {
                    notesRoot.querySelectorAll('.note')[renderedNotesIndexes[i]].classList.add('note-hover');
                };
                line.onmouseleave = () => {
                    notesRoot.querySelectorAll('.note')[renderedNotesIndexes[i]].classList.remove('note-hover');
                };
                line.onclick = () => {
                    const targetEl = notesRoot.querySelectorAll('.note')[renderedNotesIndexes[i]];
                    notesRoot.scrollTop = targetEl.offsetTop - (notesRoot.clientHeight / 2 - targetEl.offsetHeight / 2);
                };
            }
            for (let i = 0; i < diagrams.length; i++) {
                if (diagrams[i].length === 0) {
                    const line = document.createElement('div');
                    line.classList.add('line-single');
                    if (diagrams[i].important)
                        line.classList.add('line-important');
                    line.style.top = diagrams[i].startCoord - 5 + 'px';
                    line.style.height = 10 + 'px';
                    line.style.width = maxWidth + 'px';
                    line.style.zIndex = zIndexMax + 5 + '';
                    diagrams[i].width = minWidth;
                    diagrams[i].zIndex = zIndexMax;
                    _addHandlersToLine(line, i);
                    diagramsRoot.append(line);
                    continue;
                }
                if (i === 0) {
                    const line = document.createElement('div');
                    line.classList.add('line');
                    if (diagrams[i].important)
                        line.classList.add('line-important');
                    line.style.top = diagrams[i].startCoord + 'px';
                    line.style.height = diagrams[i].length + 'px';
                    line.style.width = minWidth + 'px';
                    line.style.zIndex = zIndexMax + '';
                    diagrams[i].width = minWidth;
                    diagrams[i].zIndex = zIndexMax;
                    _addHandlersToLine(line, i);
                    diagramsRoot.append(line);
                    continue;
                }
                const line = document.createElement('div');
                line.classList.add('line');
                if (diagrams[i].important)
                    line.classList.add('line-important');
                line.style.top = diagrams[i].startCoord + 'px';
                line.style.height = diagrams[i].length + 'px';
                diagrams[i].width = minWidth;
                diagrams[i].zIndex = zIndexMax;
                for (let j = 0; j < i; j++) {
                    if (_findCrossing(diagrams[j], diagrams[i])) {
                        diagrams[i].width = diagrams[j].width + minWidth;
                        diagrams[i].zIndex = diagrams[j].zIndex - 1;
                    }
                }
                line.style.width = diagrams[i].width + 'px';
                line.style.zIndex = diagrams[i].zIndex + '';
                _addHandlersToLine(line, i);
                diagramsRoot.append(line);
            }
        }
        _displayDiagrams();
    }
    function _addingBtnHandler() {
        const newNote = {
            timeStart: '',
            timeEnd: '',
            text: ''
        };
        buffer.notes.push(newNote);
        _renderNotes(newNote);
        notesRoot.scrollTop = notesRoot.scrollHeight;
    }
    function _renderDate(date) {
        const value = date.split('&').map(str => str.split('=')[1]);
        notesDate.textContent = `${new Date(parseInt(value[0]), parseInt(value[1]), parseInt(value[2])).toLocaleString('en-GB', { dateStyle: 'long' })}`;
    }
    addingBtn.onclick = _addingBtnHandler;
    notesRoot.innerHTML = '';
    _renderDate(date);
    buffer.notes.forEach((note) => _renderNotes(note));
    _renderDiagrams();
}
async function renderImportantNotes() {
    async function _getImpNotesfromServer() {
        const response = await fetch(`${serverUrl}/importantNotes`, {
            method: 'GET',
            headers: {
                'Content-type': 'application/json',
                'usecalendarkey': useCalendarKey
            },
            credentials: 'include'
        });
        return await response.json();
    }
    const importantRoot = document.querySelector('.important');
    importantRoot.innerHTML = createSpinner();
    const importantNotes = await _getImpNotesfromServer();
    if (importantNotes.status) {
        login().then(() => init());
        return;
    }
    importantRoot.innerHTML = '';
    importantNotes.forEach(note => {
        const noteEl = document.createElement('div');
        const dayEl = document.createElement('div');
        const dateEl = document.createElement('div');
        const textEl = document.createElement('div');
        const date = new Date(note.year, note.month, note.day);
        noteEl.classList.add('important__note');
        textEl.classList.add('important__text');
        dayEl.textContent = date.toLocaleString('en-GB', { weekday: 'long' });
        dateEl.textContent = date.toLocaleString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        textEl.textContent = note.text.slice(0, 10) + (note.text.length > 10 ? ' ...' : '');
        noteEl.append(dayEl, dateEl, textEl);
        importantRoot.append(noteEl);
    });
}
async function renderWeekTasks() {
    async function _getWeekTasksFromServer() {
        const response = await fetch(`${serverUrl}/weekTasks`, {
            method: 'GET',
            headers: {
                'Content-type': 'application/json',
                'usecalendarkey': useCalendarKey
            },
            credentials: 'include'
        });
        return await response.json();
    }
    const weekTasksRoot = document.querySelector('.week-tasks');
    weekTasksRoot.innerHTML = createSpinner();
    const weekTasks = await _getWeekTasksFromServer();
    if (weekTasks.status) {
        login().then(() => init());
        return;
    }
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    weekTasksRoot.innerHTML = '';
    for (let i = 0; i < weekTasks.length; i++) {
        const itemEl = document.createElement('div');
        const labelEl = document.createElement('div');
        const valueEl = document.createElement('div');
        itemEl.classList.add('week-tasks__item');
        if ((i + 1) === new Date().getDay())
            itemEl.classList.add('active');
        if (parseInt(weekTasks[i]) > 0)
            valueEl.classList.add('week-tasks__value');
        labelEl.textContent = `${dayNames[i]}`;
        valueEl.innerHTML = `<span>${weekTasks[i]}</span> tasks`;
        itemEl.append(labelEl, valueEl);
        weekTasksRoot.append(itemEl);
    }
}
function getAndRenderBuffer(date) {
    getBufferFromServer(date)
        .then((buffer) => {
        if (buffer.status) {
            login().then(() => init());
            return;
        }
        renderBuffer(buffer, date);
    });
}
class Calendar {
    date;
    daysQuantity;
    elements;
    calendarCallback;
    constructor(body, next, previous, month, year, calendarCallback) {
        this.elements = { body, next, previous, month, year };
        this.calendarCallback = calendarCallback;
        this.date = new Date();
        this.elements.next.onclick = this.next.bind(this);
        this.elements.previous.onclick = this.previous.bind(this);
        this.daysQuantity = this.getDaysQuantity(this.date.getFullYear(), this.date.getMonth());
        this.initCalendar(true);
    }
    next() {
        this.date.setDate(1);
        this.date.setMonth(this.date.getMonth() + 1);
        this.daysQuantity = this.getDaysQuantity(this.date.getFullYear(), this.date.getMonth());
        this.initCalendar();
    }
    previous() {
        this.date.setDate(1);
        this.date.setMonth(this.date.getMonth() - 1);
        this.daysQuantity = this.getDaysQuantity(this.date.getFullYear(), this.date.getMonth());
        this.initCalendar();
    }
    getDaysQuantity(year, month) {
        const daysQuantity = new Date(year, month + 1, 0).getDate();
        return daysQuantity;
    }
    initCalendar(runCallback = false) {
        this.elements.year.textContent = this.date.getFullYear().toString();
        this.elements.month.textContent = this.date.toLocaleString('en-GB', { month: 'long' });
        this.elements.body.innerHTML = '';
        const dayOfWeek = new Date(this.date.getFullYear(), this.date.getMonth(), 1).getDay();
        for (let i = 0; i < this.daysQuantity; i++) {
            const dayEl = document.createElement('div');
            const currentDate = new Date();
            if (i === 0) {
                dayEl.style.gridColumnStart = dayOfWeek === 0 ? '7' : dayOfWeek.toString();
            }
            dayEl.classList.add('calendar__item');
            dayEl.textContent = `${i + 1}`;
            if ((i + 1) === currentDate.getDate() && this.date.getMonth() === currentDate.getMonth() && this.date.getFullYear() === currentDate.getFullYear())
                dayEl.classList.add('current-active');
            dayEl.onclick = () => {
                this.elements.body.querySelectorAll('.calendar__item').forEach(item => item.classList.remove('active'));
                dayEl.classList.add('active');
                this.date.setDate(parseInt(dayEl.textContent));
                const date = `year=${this.date.getFullYear()}&month=${this.date.getMonth()}&day=${this.date.getDate()}`;
                this.calendarCallback(date);
            };
            this.elements.body.append(dayEl);
        }
        if (runCallback) {
            const date = `year=${this.date.getFullYear()}&month=${this.date.getMonth()}&day=${this.date.getDate()}`;
            this.calendarCallback(date);
        }
    }
}
async function checkLogin() {
    const response = await fetch(`${serverUrl}/checkLogin`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'usecalendarkey': useCalendarKey
        }
    });
    const result = await response.text();
    if (result === 'has login') {
        init();
    }
    else {
        login().then(() => init());
    }
}
function login() {
    return new Promise((resolve, reject) => {
        const loginEl = document.querySelector('.login');
        const loginForm = document.querySelector('.login__form');
        loginEl.classList.add('active');
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.querySelector('.login__name');
            const password = document.querySelector('.login__password');
            const inputs = Array.from(document.querySelectorAll('.login__radio'));
            const input = inputs.find(input => input.checked);
            const data = {
                name: name.value,
                password: password.value,
                type: input.value
            };
            name.value = '';
            password.value = '';
            const response = await fetch(`${serverUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const result = await response.text();
            switch (result) {
                case 'no name':
                    name.classList.add('active');
                    document.querySelector('.login__spinner .spinner-box').classList.add('active');
                    document.querySelector('.login__spinner .spin-horizontal').classList.add('active');
                    setTimeout(() => {
                        name.classList.remove('active');
                        document.querySelector('.login__spinner .spinner-box').classList.remove('active');
                        document.querySelector('.login__spinner .spin-horizontal').classList.remove('active');
                    }, 2000);
                    break;
                case 'no password':
                    password.classList.add('active');
                    document.querySelector('.login__spinner .spinner-box').classList.add('active');
                    document.querySelector('.login__spinner .spin-horizontal').classList.add('active');
                    setTimeout(() => {
                        password.classList.remove('active');
                        document.querySelector('.login__spinner .spinner-box').classList.remove('active');
                        document.querySelector('.login__spinner .spin-horizontal').classList.remove('active');
                    }, 2000);
                    break;
                case 'success login':
                    loginEl.classList.remove('active');
                    const key = response.headers.get('usecalendarkey');
                    window.localStorage.setItem('useCalendarKey', key);
                    useCalendarKey = key;
                    resolve('success login');
                    break;
                default:
                    break;
            }
        };
    });
}
function init() {
    renderTimeScale();
    renderWeekTasks();
    renderImportantNotes();
    new Calendar(document.querySelector('.calendar__body'), document.querySelector('.calendar__next-btn'), document.querySelector('.calendar__prev-btn'), document.querySelector('.calendar__month'), document.querySelector('.calendar__year'), getAndRenderBuffer);
}
checkLogin();
