import React, { useState, useEffect } from 'react';

const Timer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) return;

        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{
            fontFamily: 'monospace',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-text-light)'
        }}>
            {formatTime(elapsed)}
        </div>
    );
};

export default Timer;
