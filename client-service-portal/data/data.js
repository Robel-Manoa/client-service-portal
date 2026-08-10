// @ts-check

/**
 * Seed data for the Client Service Portal, consumed once by storage.init()
 * (see script/storage.js) to populate sessionStorage on first load. It is
 * not read again afterwards — every subsequent read/write goes through
 * sessionStorage instead, so editing this file only changes what a fresh
 * demo session starts with.
 *
 * Dates use ISO 8601 throughout, matching what
 * new Date() reliably parses across browsers
 *
 * @type {{ users: User[], requests: ServiceRequest[], assignments: Assignment[], comments: RequestComment[] }}
 */
const data = {
  users: [
    {
      id: "u1",
      name: "John Doe",
      email: "john.doe@gmail.com",
      password: "password123",
      role: "client",
      is_active: true,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
    },
    {
      id: "u2",
      name: "Jane Smith",
      email: "jane.smith@gmail.com",
      password: "password456",
      role: "engineer",
      is_active: true,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
    },
    {
      id: "u3",
      name: "Bob Johnson",
      email: "bob.johnson@gmail.com",
      password: "password789",
      role: "admin",
      is_active: true,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
    },
  ],
  requests: [
    {
      id: "r1",
      client_id: "u1",
      title: "New page",
      description: "New page for company",
      priority: "medium",
      status: "open",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      status_history: [
        { status: "open", at: "2023-01-01" },
        { status: "in_progress", at: "2023-01-02" },
      ],
    },
    {
      id: "r2",
      client_id: "u1",
      title: "New balance sheet",
      description: "New page for company",
      priority: "medium",
      status: "in_progress",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      status_history: [
        { status: "open", at: "2023-01-01" },
        { status: "in_progress", at: "2023-01-02" },
      ],
    },
  ],
  assignments: [
    {
      id: "a1",
      request_id: "r1",
      engineer_id: "u2",
      assigned_at: "2023-01-01",
    },
    {
      id: "a2",
      request_id: "r2",
      engineer_id: "u2",
      assigned_at: "2023-01-01",
    },
  ],
  comments: [
    {
      id: "c1",
      request_id: "r1",
      user_id: "u1",
      content: "Please start working on this request",
      is_internal: false,
      created_at: "2023-01-01",
    },
    {
      id: "c2",
      request_id: "r2",
      user_id: "u2",
      content: "I'm on it!",
      is_internal: false,
      created_at: "2023-01-01",
    },
  ],
};
