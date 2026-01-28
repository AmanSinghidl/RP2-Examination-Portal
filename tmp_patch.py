from pathlib import Path
path = Path('Backend/Backend/routes/admin.routes.js')
text = path.read_text()
start_token = '/* ================= CREATE EVENT ================= */'
end_token = '/* ================= UPDATE EVENT STATUS ================= */'
start = text.index(start_token)
end = text.index(end_token, start)
new_block = '''/* ================= CREATE EVENT ================= */
router.post( /event, (req, res) => {
    const {
        college_id,
        exam_name,
        exam_start_date,
        exam_end_date,
        start_time,
        end_time,
        cutoff_percentage,
        event_type
    } = req.body;

    const startDate = exam_start_date || req.body.exam_date;
    const endDate = exam_end_date || req.body.exam_date;
    const eventType = (event_type || REGULAR).toUpperCase();

    db.query(
        
        INSERT INTO exam_event
        (college_id, exam_name, exam_start_date, exam_end_date, start_time, end_time, cutoff_percentage, event_type, who_updated, updated_date, is_active, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ADMIN', CURRENT_DATE(), 'NO', 'NO')
        ,
        [
            college_id,
            exam_name,
            startDate,
            endDate,
            start_time,
            end_time,
            cutoff_percentage,
            eventType
        ],
        err => {
            if (err) {
                console.error(? Create event error:, err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

'''
path.write_text(text[:start] + new_block + text[end:])
