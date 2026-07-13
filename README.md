# Client Service Portal (CSP)

## Objectif

Build a web application to improve and manage the customer request process. <br/>

## Project progress

The project is divided into 2 phases: phase 1 deals with the structure and interface of the application, phase 2 is for the implementation of a database and the server side.

## User Roles

`Role` | `Who they are` | `What they can do` |
Client | An external company representative | Submit requests, view their own requests, add comments |
Engineer | An internal company engineer | View assigned requests, update request status, add comments (internal or visible to client) |
Admin | An internal administrator | Manage all requests, assign engineers to requests, manage user accounts |

### User account test

- name: "John Doe",
- email: "john.doe@gmail.com",
- password: "password123",
- role: "client"
<hr/>

name: "Jane Smith",
email: "jane.smith@gmail.com",
password: "password456",
role: "engineer"
<hr/>

name: "Bob Johnson",
email: "bob.johnson@gmail.com",
password: "password789",
role: "admin"

## Feature already implemented

- The use of localStorage and sessionStorage
- Login: client, admin, engineer
- On the client side: see submitted requests, submit new requests, see the progress or status of the request
- Admin side: view new requests, view request details, change the status of customer requests
- Engineer side : view of the requests assigned to them, ability to change the status of requests, view of client request details
- In the details of customer requests, the data history feature already works, showing real-time changes in the status of customer requests
- Responsive website: adapt to the requested screen sizes
- The feature for adding comments and assigning requests
- CRUD user by admin

<hr/>

## Feature to implement and possibility of evolution

- Manage user accounts 
- Add Regex
- Filter request list by date
- Research request
