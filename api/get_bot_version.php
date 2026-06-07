<?php
header('Content-Type: application/json');

echo json_encode([
    'status' => true,
    'data' => [
        'version' => '1.2.1',
        'release_date' => '2026-06-07',
        'features' => [
            'Timetable Module Added',
            'Attendance Tracking Added',
        ],
    ],
], JSON_UNESCAPED_SLASHES);
