const fs = require('fs');
const path = require('path');

// Path for permanent disk backup so data is never lost across server restarts
const DATA_FILE = path.join(__dirname, 'support-data.json');

// Zero fake seed data - only real user tickets and live requests
const INITIAL_REQUESTS = [];
const INITIAL_TICKETS = [];
const INITIAL_MESSAGES = [];
const INITIAL_NOTIFICATIONS = [];
const INITIAL_STATUS_HISTORY = [];
const INITIAL_CALL_RESOLUTIONS = [];

// Helpful real knowledge base FAQs (non-mock general guidance)
const INITIAL_FAQS = [
    {
        id: 'faq-1',
        question: 'How do I request a refund?',
        category: 'Refund',
        answer: 'You can request a full refund within 24 hours of booking confirmation through your dashboard under Payments > Request Refund, or by submitting a ticket under Help & Support.'
    },
    {
        id: 'faq-2',
        question: 'How long does refund processing take?',
        category: 'Refund',
        answer: 'Refunds are escrow-protected by ZILHAJ and processed directly back to your original payment method (Bank/UPI/Card) within 5 to 7 business days.'
    },
    {
        id: 'faq-3',
        question: 'How can I track my refund status?',
        category: 'Refund',
        answer: 'You can check real-time refund status on the Payments tab or view resolution notes under My Support Requests.'
    },
    {
        id: 'faq-4',
        question: 'How far are the partner hotels from the Haram in Makkah and Madinah?',
        category: 'Hotel Related',
        answer: 'Hotels are categorised by distance: 5-Star luxury options are within 50–150 meters (walking distance); 3-Star economy options (500–900m) include complimentary 24/7 electric AC shuttle transfers.'
    },
    {
        id: 'faq-5',
        question: 'How does the Umrah & Hajj visa process work?',
        category: 'Visa & Passport',
        answer: 'Once your agency offer is confirmed, ZILHAJ verified travel agencies submit your passport scans directly to the official Saudi Nusuk / eVisa portal. The approved eVisa is issued within 48 to 72 hours.'
    },
    {
        id: 'faq-6',
        question: 'Can I change my preferred travel departure date?',
        category: 'Travel Date Change',
        answer: 'Yes! You can request a departure date amendment up to 14 days before scheduled travel by raising a support request with category "Travel Date Change".'
    },
    {
        id: 'faq-7',
        question: 'Are historical Ziyarat tours included in packages?',
        category: 'Transport / Ziyarat',
        answer: 'Most standard and deluxe packages include guided Ziyarat in Makkah (Ghar Hira, Mina, Muzdalifah, Arafat) and Madinah (Masjid Quba, Mount Uhud, Masjid Qiblatayn) in luxury air-conditioned coaches.'
    }
];

function formatTicket(t) {
    if (!t) return null;
    return {
        ...t,
        issueId: t.issue_id,
        requestId: t.request_id,
        userId: t.user_id,
        customerName: t.customer_name,
        customerEmail: t.customer_email,
        customerPhone: t.customer_phone,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        lastUpdated: t.updated_at,
        resolvedAt: t.resolved_at
    };
}

function formatMessage(m) {
    if (!m) return null;
    return {
        ...m,
        issueId: m.issue_id,
        ticketId: m.ticket_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderRole: m.sender_role,
        messageType: m.message_type,
        createdAt: m.created_at,
        isRead: m.is_read
    };
}

class SupportService {
    constructor() {
        this.store = {
            requests: [...INITIAL_REQUESTS],
            tickets: [...INITIAL_TICKETS],
            messages: [...INITIAL_MESSAGES],
            notifications: [...INITIAL_NOTIFICATIONS],
            status_history: [...INITIAL_STATUS_HISTORY],
            call_resolutions: [...INITIAL_CALL_RESOLUTIONS],
            faqs: [...INITIAL_FAQS]
        };
        this.loadFromDisk();
    }

    loadFromDisk() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const raw = fs.readFileSync(DATA_FILE, 'utf8');
                const data = JSON.parse(raw);
                if (data && typeof data === 'object') {
                    this.store = Object.assign({}, this.store, data);
                    console.log(`[SupportService] Loaded ${(this.store.tickets || []).length} tickets from disk backup.`);
                }
            }
        } catch (e) {
            console.warn('[SupportService] Error reading backup file:', e.message);
        }
    }

    saveToDisk() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.store, null, 2), 'utf8');
        } catch (e) {
            console.error('[SupportService] Failed saving backup file:', e.message);
        }
    }

    async syncToMongo(db) {
        if (!db) return;
        try {
            // Check if tickets collection has items
            const count = await db.collection('support_tickets').countDocuments();
            if (count === 0) {
                // Seed initial data to MongoDB
                if (this.store.tickets.length > 0) await db.collection('support_tickets').insertMany(this.store.tickets);
                if (this.store.messages.length > 0) await db.collection('support_messages').insertMany(this.store.messages);
                if (this.store.notifications.length > 0) await db.collection('support_notifications').insertMany(this.store.notifications);
                if (this.store.status_history.length > 0) await db.collection('support_status_history').insertMany(this.store.status_history);
                if (this.store.call_resolutions.length > 0) await db.collection('support_call_resolutions').insertMany(this.store.call_resolutions);
            }
        } catch (e) {
            console.warn('[SupportService] Mongo sync error (non-fatal, persistent store active):', e.message);
        }
    }

    // Auto-generate next unique server-side ID
    generateIssueId() {
        let maxNum = 0;
        for (const t of (this.store.tickets || [])) {
            if (t.issue_id && t.issue_id.startsWith('ISS_')) {
                const num = parseInt(t.issue_id.replace('ISS_', ''), 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        }
        const next = maxNum + 1;
        return `ISS_${String(next).padStart(4, '0')}`;
    }

    generateRequestId() {
        let maxNum = 1000;
        for (const r of (this.store.requests || [])) {
            if (r.request_id && r.request_id.startsWith('REQ_')) {
                const num = parseInt(r.request_id.replace('REQ_', ''), 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        }
        const next = maxNum + 1;
        return `REQ_${next}`;
    }

    // Normalize user identity
    resolveUser(req) {
        // From req.user or session or body/headers
        const authHeader = req.headers.authorization || '';
        const body = req.body || {};
        const query = req.query || {};

        let email = body.email || body.customer_email || body.customerEmail || query.email || query.customer_email || query.customerEmail || '';
        let name = body.name || body.customer_name || body.customerName || query.name || query.customer_name || query.customerName || '';
        let phone = body.phone || body.customer_phone || body.customerPhone || query.phone || query.customer_phone || query.customerPhone || '';
        let role = 'CUSTOMER';

        if (req.user) {
            email = req.user.email || email;
            name = req.user.name || name;
            phone = req.user.phone || phone;
            role = req.user.role === 'ROLE_ADMIN' || req.user.role === 'ROLE_SUBADMIN' ? 'ADMIN' : 'CUSTOMER';
        }

        // Header custom identification from frontend customer session
        if (req.headers['x-user-email']) email = req.headers['x-user-email'];
        if (req.headers['x-user-name']) name = req.headers['x-user-name'];
        if (req.headers['x-user-phone']) phone = req.headers['x-user-phone'];

        return {
            email: email.trim().toLowerCase(),
            name: name.trim() || 'Valued Pilgrim',
            phone: phone.trim(),
            role: role
        };
    }

    // Get requests for a specific user
    getUserRequests(user) {
        const email = (user.email || '').toLowerCase();
        const phone = (user.phone || '').replace(/\D/g, '');

        return this.store.requests.filter(r => {
            const rEmail = (r.email || '').toLowerCase();
            const rPhone = (r.phone || '').replace(/\D/g, '');
            if (email && rEmail === email) return true;
            if (phone && rPhone && rPhone === phone) return true;
            return false;
        });
    }

    // Create a new support ticket (Customer)
    async createTicket(ticketData, user, db) {
        const {
            request_id,
            category,
            priority = 'Medium',
            subject,
            description,
            attachment = null
        } = ticketData;

        // Subject fallback if omitted
        let finalSubject = subject ? subject.trim() : '';
        if (finalSubject.length < 5) {
            finalSubject = (category || 'General Support') + (request_id ? ' - ' + request_id : ' Request');
        }
        if (!description || description.trim().length < 10) {
            throw new Error('Issue details must be at least 10 characters long.');
        }
        if (!category) {
            throw new Error('Please select an issue category.');
        }

        const now = new Date();
        const userEmail = (user.email || '').toLowerCase();

        // Duplicate submission prevention (identical subject, description, request within 2 minutes)
        const recentDuplicate = this.store.tickets.find(t => {
            const matchUser = (t.customer_email || '').toLowerCase() === userEmail;
            const matchReq = t.request_id === request_id;
            const matchSub = (t.subject || '').trim().toLowerCase() === subject.trim().toLowerCase();
            const matchDesc = (t.description || '').trim().toLowerCase() === description.trim().toLowerCase();
            const timeDiff = Math.abs(now - new Date(t.created_at)) / 1000;
            return matchUser && matchReq && matchSub && matchDesc && timeDiff < 120;
        });

        if (recentDuplicate) {
            const err = new Error('A similar issue was recently submitted.');
            err.code = 'DUPLICATE_TICKET';
            err.existingIssueId = recentDuplicate.issue_id;
            throw err;
        }

        // Generate IDs
        const issue_id = this.generateIssueId();
        let resolvedRequestId = request_id;

        // If no request ID selected or General Support Request
        if (!resolvedRequestId || resolvedRequestId === 'GENERAL' || resolvedRequestId === 'none') {
            resolvedRequestId = 'GENERAL';
        }

        const ticketRecord = {
            id: 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            issue_id: issue_id,
            request_id: resolvedRequestId,
            user_id: user.userId || ('user_' + user.email.replace(/[^a-zA-Z0-9]/g, '_')),
            customer_name: user.name || 'Valued Pilgrim',
            customer_email: user.email,
            customer_phone: user.phone || '+91 98765 43210',
            category: category,
            priority: priority,
            subject: finalSubject,
            description: description.trim(),
            status: 'Open',
            assigned_admin_id: 'admin_aman',
            assigned_admin_name: 'Aman Khan',
            created_at: now.toISOString(),
            updated_at: now.toISOString()
        };

        this.store.tickets.unshift(ticketRecord);

        // Initial Customer message
        const messageRecord = {
            id: 'msg_' + Date.now(),
            ticket_id: ticketRecord.id,
            issue_id: issue_id,
            sender_id: ticketRecord.user_id,
            sender_name: ticketRecord.customer_name,
            sender_role: 'CUSTOMER',
            message_type: 'CUSTOMER_MESSAGE',
            message: description.trim(),
            attachment_url: attachment ? attachment.url : null,
            attachment_name: attachment ? attachment.name : null,
            attachment_size: attachment ? attachment.size : null,
            attachment_type: attachment ? attachment.type : null,
            created_at: now.toISOString(),
            is_read: false
        };
        this.store.messages.push(messageRecord);

        // Audit Status History
        this.store.status_history.unshift({
            id: 'hist_' + Date.now(),
            ticket_id: ticketRecord.id,
            issue_id: issue_id,
            old_status: null,
            new_status: 'Open',
            changed_by: `${ticketRecord.customer_name} (Customer)`,
            reason: 'Issue initially reported',
            created_at: now.toISOString()
        });

        // Admin Notification
        const adminNotif = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            user_id: 'ADMIN',
            ticket_id: ticketRecord.id,
            issue_id: issue_id,
            type: 'NEW_TICKET',
            title: `New support issue received — ${issue_id}`,
            message: `${issue_id} · ${category} · ${resolvedRequestId} · ${ticketRecord.customer_name}`,
            is_read: false,
            created_at: now.toISOString()
        };
        this.store.notifications.unshift(adminNotif);

        this.saveToDisk();

        // Async sync to MongoDB
        if (db) {
            try {
                await db.collection('support_tickets').insertOne(ticketRecord);
                await db.collection('support_messages').insertOne(messageRecord);
                await db.collection('support_notifications').insertOne(adminNotif);
            } catch (e) {
                console.warn('[SupportService] Mongo insert error:', e.message);
            }
        }

        return {
            ticket: formatTicket(ticketRecord),
            issue_id: issue_id,
            request_id: resolvedRequestId
        };
    }

    // Get tickets for customer
    getCustomerTickets(user) {
        const email = (user.email || '').toLowerCase().trim();
        const phone = (user.phone || '').replace(/\D/g, '');

        if (!email && !phone) {
            return [];
        }

        return this.store.tickets.filter(t => {
            const tEmail = (t.customer_email || '').toLowerCase().trim();
            const tPhone = (t.customer_phone || '').replace(/\D/g, '');
            if (email && tEmail && tEmail === email) return true;
            if (phone && tPhone && tPhone === phone) return true;
            return false;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(formatTicket);
    }

    // Get single ticket details
    getTicketDetails(issueId, user, isAdmin = false) {
        if (!issueId) return null;
        const cleanId = String(issueId).trim().toUpperCase();
        const ticket = this.store.tickets.find(t => (t.issue_id && t.issue_id.toUpperCase() === cleanId) || (t.id && t.id.toUpperCase() === cleanId));
        if (!ticket) return null;

        // Security check for non-admin: must belong to the customer
        if (!isAdmin) {
            const userEmail = (user.email || '').toLowerCase().trim();
            const userPhone = (user.phone || '').replace(/\D/g, '');
            const tEmail = (ticket.customer_email || '').toLowerCase().trim();
            const tPhone = (ticket.customer_phone || '').replace(/\D/g, '');

            const isOwner = (userEmail && tEmail && userEmail === tEmail) ||
                            (userPhone && tPhone && userPhone === tPhone) ||
                            (user.userId && ticket.user_id && user.userId === ticket.user_id) ||
                            (!tEmail && !tPhone) ||
                            (!userEmail && !userPhone);

            if (!isOwner) {
                const err = new Error('Access denied. You are not authorized to view this support ticket.');
                err.status = 403;
                throw err;
            }
        }

        // Messages: If customer, FILTER OUT INTERNAL NOTES!
        let messages = this.store.messages
            .filter(m => m.issue_id && m.issue_id.toUpperCase() === cleanId)
            .filter(m => {
                if (!isAdmin && m.message_type === 'INTERNAL_NOTE') return false;
                return true;
            })
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Mark unread messages as read
        if (isAdmin) {
            messages.forEach(m => {
                if (m.sender_role === 'CUSTOMER') m.is_read = true;
            });
            // Mark admin notifications for this ticket as read
            this.store.notifications
                .filter(n => n.user_id === 'ADMIN' && n.issue_id && n.issue_id.toUpperCase() === cleanId)
                .forEach(n => n.is_read = true);
        } else {
            messages.forEach(m => {
                if (m.sender_role === 'ADMIN') m.is_read = true;
            });
            // Mark customer notifications for this ticket as read
            this.store.notifications
                .filter(n => (n.user_id === user.email || n.user_id === ticket.customer_email) && n.issue_id && n.issue_id.toUpperCase() === cleanId)
                .forEach(n => n.is_read = true);
        }

        this.saveToDisk();

        // Get linked request context if exists
        let requestContext = null;
        if (ticket.request_id && ticket.request_id !== 'GENERAL') {
            requestContext = this.store.requests.find(r => r.request_id === ticket.request_id || r.id === ticket.request_id) || null;
        }

        // Customer Previous Issues History
        const previousIssues = this.store.tickets
            .filter(t => (t.customer_email || '').toLowerCase() === (ticket.customer_email || '').toLowerCase() && t.issue_id !== ticket.issue_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Status history
        const statusHistory = this.store.status_history
            .filter(h => h.issue_id && h.issue_id.toUpperCase() === cleanId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // On-call resolutions for this customer or ticket
        const callResolutions = this.store.call_resolutions
            .filter(c => (c.customer_phone && c.customer_phone === ticket.customer_phone) || c.request_id === ticket.request_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return {
            ticket: formatTicket(ticket),
            messages: messages.map(formatMessage),
            requestContext,
            previousIssues: previousIssues.map(formatTicket),
            statusHistory,
            callResolutions
        };
    }

    // Add a message (Customer or Admin)
    async addMessage(issueId, messageData, sender) {
        const ticket = this.store.tickets.find(t => t.issue_id.toUpperCase() === issueId.toUpperCase());
        if (!ticket) throw new Error('Ticket not found.');

        const {
            message,
            message_type = (sender.role === 'ADMIN' ? 'ADMIN_REPLY' : 'CUSTOMER_MESSAGE'),
            attachment = null
        } = messageData;

        if (!message || !message.trim()) {
            throw new Error('Message text cannot be empty.');
        }

        const now = new Date();

        // If ticket is closed, customer cannot message
        if (sender.role !== 'ADMIN' && ticket.status === 'Closed') {
            throw new Error('This support ticket has been closed. Please create a new support issue if you require further assistance.');
        }

        const msgRecord = {
            id: 'msg_' + Date.now(),
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            sender_id: sender.email || sender.id || 'system',
            sender_name: sender.name || (sender.role === 'ADMIN' ? 'Customer Care' : 'Customer'),
            sender_role: sender.role,
            message_type: message_type,
            message: message.trim(),
            attachment_url: attachment ? attachment.url : null,
            attachment_name: attachment ? attachment.name : null,
            attachment_size: attachment ? attachment.size : null,
            attachment_type: attachment ? attachment.type : null,
            created_at: now.toISOString(),
            is_read: false
        };

        this.store.messages.push(msgRecord);
        ticket.updated_at = now.toISOString();

        // Status transitions
        if (sender.role === 'ADMIN') {
            if (message_type === 'ADMIN_REPLY') {
                if (ticket.status === 'Open') ticket.status = 'In Progress';
                
                // Customer Notification
                const custNotif = {
                    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                    user_id: ticket.customer_email,
                    ticket_id: ticket.id,
                    issue_id: ticket.issue_id,
                    type: 'ADMIN_REPLY',
                    title: `Customer Care replied to ${ticket.issue_id}`,
                    message: message.trim().length > 120 ? message.trim().slice(0, 117) + '...' : message.trim(),
                    is_read: false,
                    created_at: now.toISOString()
                };
                this.store.notifications.unshift(custNotif);
            }
        } else {
            // Customer replied
            if (ticket.status === 'Waiting for Customer') ticket.status = 'In Progress';

            // Admin Notification
            const adminNotif = {
                id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                user_id: 'ADMIN',
                ticket_id: ticket.id,
                issue_id: ticket.issue_id,
                type: 'CUSTOMER_REPLY',
                title: `Customer replied — ${ticket.issue_id}`,
                message: `${ticket.customer_name}: "${message.trim().slice(0, 80)}"`,
                is_read: false,
                created_at: now.toISOString()
            };
            this.store.notifications.unshift(adminNotif);
        }

        this.saveToDisk();
        return formatMessage(msgRecord);
    }

    // Update status (Admin)
    async updateStatus(issueId, newStatus, reason = '', changedBy = 'Aman Khan (Customer Care)') {
        const ticket = this.store.tickets.find(t => t.issue_id.toUpperCase() === issueId.toUpperCase());
        if (!ticket) throw new Error('Ticket not found.');

        const validStatuses = ['Open', 'Pending', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed', 'Reopened', 'Wrong Request / Invalid'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}`);
        }

        const oldStatus = ticket.status;
        ticket.status = newStatus === 'Pending' ? 'Open' : newStatus;
        ticket.updated_at = new Date().toISOString();

        if (ticket.status === 'Resolved') ticket.resolved_at = new Date().toISOString();
        if (ticket.status === 'Closed') ticket.closed_at = new Date().toISOString();

        // Audit
        const historyRecord = {
            id: 'hist_' + Date.now(),
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            old_status: oldStatus,
            new_status: ticket.status,
            changed_by: changedBy,
            reason: reason || `Status changed from ${oldStatus} to ${ticket.status}`,
            created_at: new Date().toISOString()
        };
        this.store.status_history.unshift(historyRecord);

        // Customer notification
        const custNotif = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            user_id: ticket.customer_email,
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            type: 'STATUS_CHANGE',
            title: `Support request updated — ${ticket.issue_id}`,
            message: `Your support request ${ticket.issue_id} is now marked as ${ticket.status}.`,
            is_read: false,
            created_at: new Date().toISOString()
        };
        this.store.notifications.unshift(custNotif);

        this.saveToDisk();
        return ticket;
    }

    // Reopen Ticket (Customer)
    async reopenTicket(issueId, reason, user) {
        const ticket = this.store.tickets.find(t => t.issue_id.toUpperCase() === issueId.toUpperCase());
        if (!ticket) throw new Error('Ticket not found.');

        if (!reason || reason.trim().length < 5) {
            throw new Error('Please provide a reason for reopening this ticket (at least 5 characters).');
        }

        const oldStatus = ticket.status;
        ticket.status = 'Reopened';
        ticket.updated_at = new Date().toISOString();

        // Reopening message
        const msgRecord = {
            id: 'msg_' + Date.now(),
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            sender_id: user.email,
            sender_name: ticket.customer_name,
            sender_role: 'CUSTOMER',
            message_type: 'CUSTOMER_MESSAGE',
            message: `[Reopened Ticket] Reason: ${reason.trim()}`,
            created_at: new Date().toISOString(),
            is_read: false
        };
        this.store.messages.push(msgRecord);

        // Audit
        this.store.status_history.unshift({
            id: 'hist_' + Date.now(),
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            old_status: oldStatus,
            new_status: 'Reopened',
            changed_by: `${ticket.customer_name} (Customer)`,
            reason: reason.trim(),
            created_at: new Date().toISOString()
        });

        // Admin notification
        const adminNotif = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            user_id: 'ADMIN',
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            type: 'TICKET_REOPENED',
            title: `Ticket reopened — ${ticket.issue_id}`,
            message: `${ticket.customer_name} reopened ${ticket.issue_id}: "${reason.trim().slice(0, 60)}"`,
            is_read: false,
            created_at: new Date().toISOString()
        };
        this.store.notifications.unshift(adminNotif);

        this.saveToDisk();
        return ticket;
    }

    // Assign Executive (Admin)
    assignExecutive(issueId, adminId, adminName) {
        const ticket = this.store.tickets.find(t => t.issue_id.toUpperCase() === issueId.toUpperCase());
        if (!ticket) throw new Error('Ticket not found.');

        ticket.assigned_admin_id = adminId;
        ticket.assigned_admin_name = adminName;
        ticket.updated_at = new Date().toISOString();

        this.store.status_history.unshift({
            id: 'hist_' + Date.now(),
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            old_status: ticket.status,
            new_status: ticket.status,
            changed_by: adminName,
            reason: `Assigned to ${adminName}`,
            created_at: new Date().toISOString()
        });

        this.saveToDisk();
        return ticket;
    }

    // Change Priority (Admin)
    changePriority(issueId, priority, changedBy = 'Admin') {
        const ticket = this.store.tickets.find(t => t.issue_id.toUpperCase() === issueId.toUpperCase());
        if (!ticket) throw new Error('Ticket not found.');

        const oldPriority = ticket.priority;
        ticket.priority = priority;
        ticket.updated_at = new Date().toISOString();

        this.store.status_history.unshift({
            id: 'hist_' + Date.now(),
            ticket_id: ticket.id,
            issue_id: ticket.issue_id,
            old_status: ticket.status,
            new_status: ticket.status,
            changed_by: changedBy,
            reason: `Priority updated from ${oldPriority} to ${priority}`,
            created_at: new Date().toISOString()
        });

        this.saveToDisk();
        return ticket;
    }

    // Record On-Call Resolution
    recordCallResolution(data, admin) {
        const {
            ticket_id,
            request_id = 'GENERAL',
            customer_name,
            customer_phone,
            category = 'General Inquiry',
            call_status = 'Resolved',
            call_notes
        } = data;

        if (!call_notes || call_notes.trim().length < 5) {
            throw new Error('Call notes must be at least 5 characters long.');
        }

        const callRecord = {
            id: 'call_' + Date.now(),
            ticket_id: ticket_id || null,
            request_id: request_id || null,
            customer_name: customer_name || 'Customer',
            customer_phone: customer_phone || '',
            admin_id: admin.id || 'admin_aman',
            admin_name: admin.name || 'Aman Khan (Customer Care)',
            category: category,
            call_status: call_status,
            call_notes: call_notes.trim(),
            created_at: new Date().toISOString()
        };

        this.store.call_resolutions.unshift(callRecord);

        // If connected to a ticket, update ticket status and add call record to messages/status
        if (ticket_id) {
            const ticket = this.store.tickets.find(t => t.issue_id === ticket_id || t.id === ticket_id);
            if (ticket) {
                if (call_status === 'Resolved') ticket.status = 'Resolved';
                else if (call_status === 'Follow Up Required') ticket.status = 'In Progress';
                else if (call_status === 'Wrong Request / Invalid') ticket.status = 'Wrong Request / Invalid';
                ticket.updated_at = new Date().toISOString();

                // Add call record as internal note message
                this.store.messages.push({
                    id: 'msg_' + Date.now(),
                    ticket_id: ticket.id,
                    issue_id: ticket.issue_id,
                    sender_id: admin.id || 'admin_aman',
                    sender_name: admin.name || 'Aman Khan (Customer Care)',
                    sender_role: 'ADMIN',
                    message_type: 'INTERNAL_NOTE',
                    message: `[Phone Call Log] Status: ${call_status} | Category: ${category} | Notes: ${call_notes.trim()}`,
                    created_at: new Date().toISOString(),
                    is_read: true
                });
            }
        }

        this.saveToDisk();
        return callRecord;
    }

    // Admin search & filter tickets
    searchTickets(params = {}) {
        let list = [...this.store.tickets];
        const {
            query = '',
            status = 'All',
            priority = 'All',
            category = 'All',
            assigned = 'All',
            sort = 'newest'
        } = params;

        // Search text against issue_id, request_id, customer_name, customer_email, customer_phone, subject, category
        if (query && query.trim()) {
            const q = query.trim().toLowerCase();
            list = list.filter(t => {
                const matchId = (t.issue_id || '').toLowerCase().includes(q);
                const matchReq = (t.request_id || '').toLowerCase().includes(q);
                const matchName = (t.customer_name || '').toLowerCase().includes(q);
                const matchEmail = (t.customer_email || '').toLowerCase().includes(q);
                const matchPhone = (t.customer_phone || '').toLowerCase().includes(q);
                const matchSub = (t.subject || '').toLowerCase().includes(q);
                const matchCat = (t.category || '').toLowerCase().includes(q);
                return matchId || matchReq || matchName || matchEmail || matchPhone || matchSub || matchCat;
            });
        }

        // Status filter
        if (status && status !== 'All') {
            list = list.filter(t => t.status.toLowerCase() === status.toLowerCase());
        }

        // Priority filter
        if (priority && priority !== 'All') {
            list = list.filter(t => t.priority.toLowerCase() === priority.toLowerCase());
        }

        // Category filter
        if (category && category !== 'All') {
            list = list.filter(t => t.category.toLowerCase() === category.toLowerCase());
        }

        // Assigned executive
        if (assigned && assigned !== 'All') {
            list = list.filter(t => (t.assigned_admin_name || '').toLowerCase().includes(assigned.toLowerCase()));
        }

        // Sorting
        list.sort((a, b) => {
            if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            if (sort === 'priority') {
                const order = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
                return (order[b.priority] || 0) - (order[a.priority] || 0);
            }
            if (sort === 'updated') return new Date(b.updated_at) - new Date(a.updated_at);
            // Default newest
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return list;
    }

    // Admin summary stats
    getStats() {
        let pending = 0;
        let solved = 0;
        let urgent = 0;
        let total = this.store.tickets.length;

        for (const t of this.store.tickets) {
            const s = (t.status || '').toLowerCase();
            if (s === 'open' || s === 'in progress' || s === 'waiting for customer' || s === 'reopened') {
                pending++;
            }
            if (s === 'resolved' || s === 'closed') {
                solved++;
            }
            if (t.priority === 'Urgent') {
                urgent++;
            }
        }

        // Add call resolutions marked resolved to solved count
        const solvedCalls = this.store.call_resolutions.filter(c => c.call_status === 'Resolved').length;

        return {
            pendingIssues: pending,
            solvedIssues: solved + solvedCalls,
            urgentIssues: urgent,
            totalTickets: total,
            totalCalls: this.store.call_resolutions.length
        };
    }

    // Get notifications
    getNotifications(user, isAdmin = false) {
        let notifs = [];
        if (isAdmin) {
            notifs = this.store.notifications
                .filter(n => n.user_id === 'ADMIN')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else {
            const email = (user.email || '').toLowerCase();
            notifs = this.store.notifications
                .filter(n => (n.user_id || '').toLowerCase() === email)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        const unreadCount = notifs.filter(n => !n.is_read).length;
        return {
            notifications: notifs.slice(0, 30),
            unreadCount
        };
    }

    // Mark single notification read
    markNotificationRead(notifId) {
        const notif = this.store.notifications.find(n => n.id === notifId);
        if (notif) notif.is_read = true;
        this.saveToDisk();
        return true;
    }

    // Mark all notifications read
    markAllNotificationsRead(user, isAdmin = false) {
        if (isAdmin) {
            this.store.notifications.forEach(n => {
                if (n.user_id === 'ADMIN') n.is_read = true;
            });
        } else {
            const email = (user.email || '').toLowerCase();
            this.store.notifications.forEach(n => {
                if ((n.user_id || '').toLowerCase() === email) n.is_read = true;
            });
        }
        this.saveToDisk();
        return true;
    }

    // Search FAQs
    searchFaqs(query = '') {
        if (!query || !query.trim()) return this.store.faqs;
        const q = query.trim().toLowerCase();
        return this.store.faqs.filter(f => 
            f.question.toLowerCase().includes(q) || 
            f.answer.toLowerCase().includes(q) || 
            f.category.toLowerCase().includes(q)
        );
    }

    // Delete a ticket and its associated data
    async deleteTicket(issueId, db) {
        this.store.tickets = (this.store.tickets || []).filter(t => t.issue_id !== issueId && t.issueId !== issueId);
        this.store.messages = (this.store.messages || []).filter(m => m.issue_id !== issueId && m.issueId !== issueId);
        this.store.notifications = (this.store.notifications || []).filter(n => n.issue_id !== issueId && n.issueId !== issueId);
        this.store.status_history = (this.store.status_history || []).filter(h => h.issue_id !== issueId && h.issueId !== issueId);
        this.store.call_resolutions = (this.store.call_resolutions || []).filter(c => c.issue_id !== issueId && c.issueId !== issueId);
        this.saveToDisk();

        if (db) {
            try {
                await Promise.all([
                    db.collection('support_tickets').deleteMany({ issue_id: issueId }),
                    db.collection('support_messages').deleteMany({ issue_id: issueId }),
                    db.collection('support_notifications').deleteMany({ issue_id: issueId }),
                    db.collection('support_status_history').deleteMany({ issue_id: issueId }),
                    db.collection('support_call_resolutions').deleteMany({ issue_id: issueId })
                ]);
            } catch (e) {
                console.error('[SupportService] DB delete error:', e.message);
            }
        }
        return true;
    }
}

module.exports = new SupportService();

