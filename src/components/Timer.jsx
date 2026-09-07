import React, { useState, useEffect } from 'react';
import { formatTime } from '../lib/time';

const Timer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) return;

        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

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
