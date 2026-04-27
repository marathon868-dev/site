/**
 * Kamil Galeev Final Form
 * Полная версия с Supabase бэкендом
 */

// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    
    // ===== КОНФИГУРАЦИЯ SUPABASE =====
    // ⚠️ ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ НА ВАШИ ИЗ ПРОЕКТА SUPABASE ⚠️
    const SUPABASE_URL = 'https://pegapsojgtjiugsetadx.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZ2Fwc29qZ3RqaXVnc2V0YWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTYxODYsImV4cCI6MjA5Mjg5MjE4Nn0.Ybv1SvevZz-D4WkAdzJpQ2EdneqKjhbmxckKIYKlzys';
    
    // Проверяем, загрузился ли Supabase SDK
    if (typeof supabase === 'undefined') {
        console.error('Supabase SDK не загрузился! Проверьте подключение к интернету.');
        alert('Ошибка: не удалось загрузить Supabase. Проверьте соединение с интернетом.');
        return;
    }
    
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase инициализирован');
    
    // ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ =====
    let posts = [];
    let currentPostIdForComment = null;
    let currentImageData = null;
    let isLoading = false;
    let likedPosts = new Set();
    let lastUsedNickname = localStorage.getItem('last_comment_nickname') || '';

    // ===== DOM ЭЛЕМЕНТЫ =====
    const postsContainer = document.getElementById('postsContainer');
    const postContentInput = document.getElementById('postContentInput');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const commentModal = document.getElementById('commentModal');
    const commentInput = document.getElementById('commentInput');
    const commentNickname = document.getElementById('commentNickname');
    const submitCommentBtn = document.getElementById('submitCommentBtn');
    const cancelCommentBtn = document.getElementById('cancelCommentBtn');
    const closeModalSpan = document.querySelector('.close-modal');
    const quickEmojis = document.querySelectorAll('.quick-emoji');
    const imageInput = document.getElementById('imageInput');
    const attachImageBtn = document.getElementById('attachImageBtn');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');

    // ===== ФУНКЦИИ РАБОТЫ С SUPABASE =====
    
    // Загрузка постов
    async function loadPostsFromSupabase() {
        if (isLoading) return;
        isLoading = true;
        
        try {
            postsContainer.innerHTML = '<div class="empty-feed">⏳ загрузка постов...</div>';
            
            // Загружаем посты
            const { data: postsData, error: postsError } = await supabaseClient
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (postsError) throw postsError;
            
            // Загружаем комментарии
            const { data: commentsData, error: commentsError } = await supabaseClient
                .from('comments')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (commentsError) throw commentsError;
            
            // Группируем комментарии
            const commentsByPost = {};
            if (commentsData) {
                commentsData.forEach(comment => {
                    if (!commentsByPost[comment.post_id]) {
                        commentsByPost[comment.post_id] = [];
                    }
                    commentsByPost[comment.post_id].push({
                        id: comment.id,
                        text: comment.content,
                        nickname: comment.nickname || 'Аноним',
                        date: new Date(comment.created_at).toLocaleString()
                    });
                });
            }
            
            // Формируем финальный массив постов
            posts = (postsData || []).map(post => ({
                id: post.id,
                content: post.content || '',
                likes: post.likes || 0,
                date: new Date(post.created_at).toLocaleString(),
                imageData: post.image_data,
                comments: commentsByPost[post.id] || []
            }));
            
            renderFeed();
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            postsContainer.innerHTML = '<div class="empty-feed">❌ ошибка загрузки. обнови страницу</div>';
        } finally {
            isLoading = false;
        }
    }
    
    // Создание поста
    async function createNewPost() {
        const content = postContentInput.value.trim();
        if (content === "" && !currentImageData) {
            alert("Нельзя отправить пустой пост ✧ добавь текст или фото");
            return;
        }
        
        const originalText = submitPostBtn.textContent;
        submitPostBtn.textContent = '⏳ сохраняем...';
        submitPostBtn.disabled = true;
        
        try {
            const newPost = {
                content: content || "",
                image_data: currentImageData || null,
                likes: 0,
                created_at: new Date().toISOString()
            };
            
            const { error } = await supabaseClient
                .from('posts')
                .insert([newPost]);
            
            if (error) throw error;
            
            // Очищаем форму
            postContentInput.value = '';
            currentImageData = null;
            imagePreviewContainer.style.display = 'none';
            imagePreview.src = '';
            
            await loadPostsFromSupabase();
            
        } catch (error) {
            console.error('Ошибка создания:', error);
            alert('❌ не удалось создать пост: ' + error.message);
        } finally {
            submitPostBtn.textContent = originalText;
            submitPostBtn.disabled = false;
        }
    }
    
    // Добавление комментария
    async function addCommentToCurrentPost() {
        if (currentPostIdForComment === null) return;
        
        const commentText = commentInput.value.trim();
        if (commentText === "") {
            alert("Напиши комментарий ❤️");
            return;
        }
        
        let nickname = commentNickname ? commentNickname.value.trim() : '';
        if (nickname === "") {
            nickname = "Аноним";
        }
        
        const originalText = submitCommentBtn.textContent;
        submitCommentBtn.textContent = '⏳...';
        submitCommentBtn.disabled = true;
        
        try {
            const newComment = {
                post_id: currentPostIdForComment,
                content: commentText,
                nickname: nickname,
                created_at: new Date().toISOString()
            };
            
            const { error } = await supabaseClient
                .from('comments')
                .insert([newComment]);
            
            if (error) throw error;
            
            lastUsedNickname = nickname;
            localStorage.setItem('last_comment_nickname', nickname);
            
            await loadPostsFromSupabase();
            closeModal();
            
        } catch (error) {
            console.error('Ошибка создания комментария:', error);
            alert('❌ не удалось добавить комментарий: ' + error.message);
        } finally {
            submitCommentBtn.textContent = originalText;
            submitCommentBtn.disabled = false;
        }
    }
    
    // Переключение лайка
    async function toggleLike(postId, currentLikes, isLiked) {
        const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;
        
        try {
            const { error } = await supabaseClient
                .from('posts')
                .update({ likes: Math.max(0, newLikes) })
                .eq('id', postId);
            
            if (error) throw error;
            
            if (isLiked) {
                likedPosts.delete(postId);
            } else {
                likedPosts.add(postId);
            }
            localStorage.setItem('kamil_liked_posts', JSON.stringify(Array.from(likedPosts)));
            
            // Обновляем локально
            const post = posts.find(p => p.id === postId);
            if (post) {
                post.likes = Math.max(0, newLikes);
                updateLikeButton(postId, post.likes, !isLiked);
            }
            
        } catch (error) {
            console.error('Ошибка обновления лайка:', error);
        }
    }
    
    // Обновление кнопки лайка без перерисовки всей ленты
    function updateLikeButton(postId, likes, isLiked) {
        const likeBtn = document.querySelector(`.like-btn[data-id="${postId}"]`);
        if (likeBtn) {
            const likeIcon = isLiked ? '❤️' : '🖤';
            likeBtn.innerHTML = `${likeIcon} <span class="like-count">${likes}</span>`;
            if (isLiked) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        }
    }
    
    // ===== UI ФУНКЦИИ =====
    
    function renderFeed() {
        if (!postsContainer) return;
        
        if (posts.length === 0) {
            postsContainer.innerHTML = `<div class="empty-feed">пока нет постов. создай первый ✨</div>`;
            return;
        }
        
        let html = '';
        for (const post of posts) {
            const likeCount = post.likes || 0;
            const commentsArray = post.comments || [];
            const commentsCount = commentsArray.length;
            const isLiked = likedPosts.has(post.id);
            const likeIcon = isLiked ? '❤️' : '🖤';
            
            let imageHtml = '';
            if (post.imageData) {
                imageHtml = `<div class="post-image">
                                <img src="${post.imageData}" alt="post image" loading="lazy">
                             </div>`;
            }
            
            let commentsHtml = '<div class="comments-section"><div class="comments-title">💬 комментарии (' + commentsCount + ')</div>';
            if (commentsArray.length > 0) {
                for (const comment of commentsArray) {
                    commentsHtml += `
                        <div class="comment-item">
                            <div class="comment-header">
                                <span class="comment-author">${escapeHtml(comment.nickname)}</span>
                                <span class="comment-date">${escapeHtml(comment.date)}</span>
                            </div>
                            <div class="comment-text">${escapeHtml(comment.text)}</div>
                        </div>
                    `;
                }
            } else {
                commentsHtml += '<div class="empty-comments">нет комментариев. добавь эмодзи ⤴️</div>';
            }
            commentsHtml += '</div>';
            
            html += `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <span class="post-id">#${post.id}</span>
                        <span class="post-date">${escapeHtml(post.date)}</span>
                    </div>
                    <div class="post-content">${escapeHtml(post.content)}</div>
                    ${imageHtml}
                    <div class="post-actions">
                        <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${post.id}">
                            ${likeIcon} <span class="like-count">${likeCount}</span>
                        </button>
                        <button class="comment-btn" data-id="${post.id}">
                            💬 ${commentsCount}
                        </button>
                    </div>
                    ${commentsHtml}
                </div>
            `;
        }
        
        postsContainer.innerHTML = html;
        
        // Навешиваем обработчики
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', handleLikeClick);
        });
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', handleCommentClick);
        });
    }
    
    function handleLikeClick(e) {
        const btn = e.currentTarget;
        const postId = parseInt(btn.getAttribute('data-id'));
        const post = posts.find(p => p.id === postId);
        if (post) {
            const isLiked = likedPosts.has(postId);
            toggleLike(postId, post.likes, isLiked);
        }
    }
    
    function handleCommentClick(e) {
        const btn = e.currentTarget;
        const postId = parseInt(btn.getAttribute('data-id'));
        currentPostIdForComment = postId;
        commentInput.value = '';
        if (commentNickname) {
            commentNickname.value = lastUsedNickname;
        }
        commentModal.style.display = 'flex';
        if (commentNickname) commentNickname.focus();
    }
    
    function closeModal() {
        commentModal.style.display = 'none';
        currentPostIdForComment = null;
        commentInput.value = '';
    }
    
    // Обработка фото
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    // Загрузка сохраненных лайков
    function loadLikedPosts() {
        const saved = localStorage.getItem('kamil_liked_posts');
        if (saved) {
            try {
                likedPosts = new Set(JSON.parse(saved));
            } catch(e) { console.warn(e); }
        }
    }
    
    // ===== НАСТРОЙКА ОБРАБОТЧИКОВ =====
    
    attachImageBtn.addEventListener('click', () => {
        imageInput.click();
    });
    
    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 2 * 1024 * 1024) {
                alert('❌ файл слишком большой! Максимум 2MB');
                return;
            }
            try {
                currentImageData = await fileToBase64(file);
                imagePreview.src = currentImageData;
                imagePreviewContainer.style.display = 'inline-block';
            } catch (error) {
                console.error('Ошибка загрузки фото:', error);
            }
        }
        imageInput.value = '';
    });
    
    removeImageBtn.addEventListener('click', () => {
        currentImageData = null;
        imagePreviewContainer.style.display = 'none';
        imagePreview.src = '';
    });
    
    submitPostBtn.addEventListener('click', createNewPost);
    submitCommentBtn.addEventListener('click', addCommentToCurrentPost);
    cancelCommentBtn.addEventListener('click', closeModal);
    closeModalSpan.addEventListener('click', closeModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === commentModal) closeModal();
    });
    
    quickEmojis.forEach(emojiSpan => {
        emojiSpan.addEventListener('click', (e) => {
            const emoji = e.currentTarget.innerText;
            commentInput.value += emoji;
            commentInput.focus();
        });
    });
    
    commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addCommentToCurrentPost();
        }
    });
    
    if (commentNickname) {
        commentNickname.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commentInput.focus();
            }
        });
    }
    
    // ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
    async function init() {
        console.log('Инициализация приложения...');
        loadLikedPosts();
        await loadPostsFromSupabase();
        console.log('Приложение готово!');
    }
    
    init();
});