
import { useEffect, useRef, useState } from 'react';
import { Chart, Filler } from 'chart.js';


// Register the filler plugin
Chart.register(Filler);

const ChartSection = ({ profitLossData, theme }) => {
    // Reference to the canvas element
    const canvasRef = useRef(null);

    // Track the chart instance
    const [chartInstance, setChartInstance] = useState(null);

    useEffect(() => {
        // If a chart already exists, destroy it before creating a new one
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Create a new chart instance
        const ctx = canvasRef.current.getContext('2d');
        const newChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: profitLossData.length }, (_, i) => `Day ${i + 1}`),
                datasets: [{
                    label: 'Net Profit/Loss',
                    data: profitLossData,
                    fill: true,  // Enable filling area under the line
                    borderColor: theme === 'dark' ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)',
                    backgroundColor: theme === 'dark' ? 'rgba(255, 250, 255, 0.1)' : 'rgba(75, 192, 192, 0.2)', // Fill color
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Net Profit/Loss'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Days'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: theme === 'dark' ? '#fff' : '#00000', // Dynamic font color
                        }
                    }
                }
            }
        });

        // Set the chart instance in the state
        setChartInstance(newChart);

        // Cleanup function: destroy chart on unmount or re-render
        return () => {
            if (newChart) {
                newChart.destroy();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profitLossData, theme]);  // Re-run effect if profitLossData or theme changes

    return (
        <canvas ref={canvasRef} className={`${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-black'}  w-full h-80 mt-3 p-3 rounded-3xl `} id="profitLossChart"></canvas>
    );
};

export default ChartSection;
