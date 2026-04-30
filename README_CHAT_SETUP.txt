BetAI chat backend setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Open the file supabase_chat_setup.sql from this zip.
4. Paste all SQL and run it.
5. Deploy the updated index.html from this zip to your app.
6. Register at least 2 users in the app.
7. Log in on one account and log in on another browser/device with the second account.
8. Click the 💬 icon next to the bell.
9. Search the other user by email or username part.
10. Open the conversation and send a message.

What is already ready in this zip:
- topbar message icon
- user list from Supabase profiles
- live private messages via Supabase direct_messages
- unread badge
- online/offline via presence_heartbeats
- search by email/name
- loader and login left untouched

If messages do not appear:
- make sure the SQL ran successfully
- make sure both users are registered and logged in at least once
- make sure profiles table contains both users
- refresh the app after running SQL