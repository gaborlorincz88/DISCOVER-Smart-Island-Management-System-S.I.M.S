document.addEventListener('DOMContentLoaded', () => {
    const downloadForm = document.getElementById('download-tiles-form');
    const downloadStatus = document.getElementById('download-status');

    downloadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(downloadForm);
        const data = Object.fromEntries(formData.entries());

        const response = await fetch('/admin/download-tiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.text();
        downloadStatus.textContent = result;
    });
});
