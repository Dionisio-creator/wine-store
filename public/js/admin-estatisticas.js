// ============================================
// ADMIN — ABA "ESTATÍSTICAS" (painel do Looker Studio)
// ============================================
// O painel é montado no Looker Studio com os dados do Google Analytics;
// aqui só guardamos o link e mostramos o painel dentro do admin.
// Usa requisicao(), mostrarToast() e $ de admin.js.

function mostrarPainelEstatisticas(link) {
    const temLink = Boolean(link);
    $('#estatisticasPainel').hidden = !temLink;
    $('#estatisticasComoFazer').hidden = temLink;
    $('#estatisticasLink').value = link;
    // Só troca o endereço quando muda, para não recarregar o painel à toa
    if (temLink && $('#estatisticasFrame').getAttribute('src') !== link) {
        $('#estatisticasFrame').setAttribute('src', link);
    }
}

function mensagemEstatisticas(texto, tipo = '') {
    const elemento = $('#estatisticasMensagem');
    elemento.textContent = texto;
    elemento.className = `form-message${tipo ? ` ${tipo}` : ''}`;
}

async function carregarEstatisticas() {
    try {
        const { link } = await requisicao('/api/admin/estatisticas');
        mostrarPainelEstatisticas(link);
    } catch (erro) {
        mostrarToast(erro.message, 'error');
    }
}

async function salvarLinkEstatisticas(evento) {
    evento.preventDefault();
    mensagemEstatisticas('');
    try {
        const { link } = await requisicao('/api/admin/estatisticas', {
            method: 'PUT',
            body: JSON.stringify({ link: $('#estatisticasLink').value })
        });
        mostrarPainelEstatisticas(link);
        mostrarToast(link ? 'Painel de estatísticas salvo.' : 'Link do painel removido.', 'success');
    } catch (erro) {
        mensagemEstatisticas(erro.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('#estatisticasForm').addEventListener('submit', salvarLinkEstatisticas);
});
