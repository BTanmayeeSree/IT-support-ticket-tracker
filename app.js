"use strict";

const STORAGE_KEY = "it-support-tickets";
const VALID_STATUSES = ["Open", "In Progress", "Resolved"];
const VALID_PRIORITIES = ["Low", "Medium", "High"];
const VALID_CATEGORIES = ["Hardware", "Software", "Network", "Access", "Other"];

const form = document.querySelector("#ticket-form");
const ticketList = document.querySelector("#ticket-list");
const searchInput = document.querySelector("#ticket-search");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const formMessage = document.querySelector("#form-message");
const storageNotice = document.querySelector("#storage-notice");
let tickets = loadTickets();

document.querySelector("#today-date").textContent = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric"
}).format(new Date());

form.addEventListener("submit", handleFormSubmit);
searchInput.addEventListener("input", renderTickets);
ticketList.addEventListener("change", handleTicketChange);
ticketList.addEventListener("click", handleTicketAction);
document.addEventListener("keydown", (event) => {
	if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
		event.preventDefault();
		searchInput.focus();
	}
});

renderTickets();

function loadTickets() {
	try {
		const storedValue = localStorage.getItem(STORAGE_KEY);
		if (!storedValue) return [];
		const parsedValue = JSON.parse(storedValue);
		if (!Array.isArray(parsedValue)) return [];
		return parsedValue.filter(isValidTicket);
	} catch {
		storageNotice.hidden = false;
		storageNotice.textContent = "Saved tickets could not be read. New changes may not persist in this browser.";
		return [];
	}
}

function isValidTicket(ticket) {
	return ticket && typeof ticket === "object"
		&& typeof ticket.id === "string"
		&& typeof ticket.title === "string" && ticket.title.trim() !== ""
		&& typeof ticket.requester === "string" && ticket.requester.trim() !== ""
		&& VALID_CATEGORIES.includes(ticket.category)
		&& VALID_PRIORITIES.includes(ticket.priority)
		&& VALID_STATUSES.includes(ticket.status)
		&& typeof ticket.description === "string"
		&& typeof ticket.createdAt === "string";
}

function handleFormSubmit(event) {
	event.preventDefault();
	formMessage.textContent = "";
	const formData = new FormData(form);
	const title = String(formData.get("title") || "").trim();
	const requester = String(formData.get("requester") || "").trim();
	const category = String(formData.get("category") || "");
	const priority = String(formData.get("priority") || "");
	const description = String(formData.get("description") || "").trim();

	if (!title || !requester || !VALID_CATEGORIES.includes(category)
			|| !VALID_PRIORITIES.includes(priority) || !description) {
		formMessage.textContent = "Complete every required field before creating the ticket.";
		const firstMissingField = [...form.elements].find((field) => field.required && !field.value.trim());
		if (firstMissingField) firstMissingField.focus();
		return;
	}

	tickets.unshift({
		id: createTicketId(),
		title,
		requester,
		category,
		priority,
		description,
		status: "Open",
		createdAt: new Date().toISOString()
	});
	saveTickets();
	form.reset();
	renderTickets();
	document.querySelector("#ticket-title").focus();
}

function createTicketId() {
	return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function handleTicketChange(event) {
	if (!event.target.matches(".ticket-status")) return;
	const ticket = tickets.find((item) => item.id === event.target.dataset.ticketId);
	if (!ticket || !VALID_STATUSES.includes(event.target.value)) return;
	ticket.status = event.target.value;
	saveTickets();
	renderTickets();
}

function handleTicketAction(event) {
	const deleteButton = event.target.closest(".delete-button");
	if (!deleteButton) return;
	const ticket = tickets.find((item) => item.id === deleteButton.dataset.ticketId);
	if (!ticket || !window.confirm(`Delete "${ticket.title}"? This cannot be undone.`)) return;
	tickets = tickets.filter((item) => item.id !== ticket.id);
	saveTickets();
	renderTickets();
}

function saveTickets() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
		storageNotice.hidden = true;
	} catch {
		storageNotice.hidden = false;
		storageNotice.textContent = "Changes are visible for this session but could not be saved to browser storage.";
	}
}

function renderTickets() {
	const query = searchInput.value.trim().toLocaleLowerCase();
	const visibleTickets = tickets.filter((ticket) =>
		ticket.title.toLocaleLowerCase().includes(query)
		|| ticket.requester.toLocaleLowerCase().includes(query)
	);

	ticketList.replaceChildren(...visibleTickets.map(createTicketRow));
	emptyState.hidden = visibleTickets.length > 0;
	if (tickets.length === 0) {
		emptyTitle.textContent = "The queue is clear.";
		emptyCopy.textContent = "New requests will show up here once they are logged.";
	} else if (visibleTickets.length === 0) {
		emptyTitle.textContent = "No matching tickets.";
		emptyCopy.textContent = "Try another title or requester name.";
	}
	document.querySelector("#queue-size").textContent = String(visibleTickets.length);
	document.querySelector("#count-total").textContent = String(tickets.length);
	document.querySelector("#count-open").textContent = String(countByStatus("Open"));
	document.querySelector("#count-progress").textContent = String(countByStatus("In Progress"));
	document.querySelector("#count-resolved").textContent = String(countByStatus("Resolved"));
}

function countByStatus(status) {
	return tickets.filter((ticket) => ticket.status === status).length;
}

function createTicketRow(ticket) {
	const row = document.createElement("article");
	row.className = "ticket-row";

	const details = document.createElement("div");
	details.className = "ticket-main";
	const title = document.createElement("h3");
	title.className = "ticket-title";
	title.textContent = ticket.title;
	const metadata = document.createElement("p");
	metadata.className = "ticket-meta";
	const requester = document.createElement("span");
	requester.textContent = ticket.requester;
	const category = document.createElement("span");
	category.textContent = ticket.category;
	metadata.append(requester, category);
	details.append(title, metadata);

	const priority = document.createElement("span");
	priority.className = `priority-badge priority-${ticket.priority.toLowerCase()}`;
	priority.textContent = ticket.priority;
	if (ticket.priority === "High") priority.setAttribute("aria-label", "High priority");

	const status = document.createElement("select");
	status.className = `ticket-status ${statusClass(ticket.status)}`;
	status.dataset.ticketId = ticket.id;
	status.setAttribute("aria-label", `Status for ${ticket.title}`);
	VALID_STATUSES.forEach((statusName) => {
		const option = document.createElement("option");
		option.value = statusName;
		option.textContent = statusName;
		option.selected = statusName === ticket.status;
		status.append(option);
	});

	const deleteButton = document.createElement("button");
	deleteButton.className = "delete-button";
	deleteButton.type = "button";
	deleteButton.dataset.ticketId = ticket.id;
	deleteButton.setAttribute("aria-label", `Delete ticket: ${ticket.title}`);
	deleteButton.title = "Delete ticket";
	deleteButton.textContent = "×";

	row.append(details, priority, status, deleteButton);
	row.title = ticket.description;
	return row;
}

function statusClass(status) {
	if (status === "In Progress") return "status-progress";
	if (status === "Resolved") return "status-resolved";
	return "status-open";
}
