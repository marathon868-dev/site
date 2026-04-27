/**
 * Kamil Galeev Final Form
 * Лента постов: создание, лайки (toggle), комментарии с ником и эмодзи, фото
 * Данные хранятся в localStorage
 */

(function() {
    // --- Состояние приложения ---
    let posts = [];
    let nextId = 1;
    let currentPostIdForComment = null;
    let currentImageData = null;

    // Хранилище ID постов, которые лайкнул текущий пользователь
    let likedPosts = new Set();

    // Сохраняем последний использованный ник (для удобства)
    let lastUsedNickname = localStorage.getItem('last_comment_nickname') || '';

    // --- DOM элементы ---
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
    
    // элементы для фото
    const imageInput = document.getElementById('imageInput');
    const attachImageBtn = document.getElementById('attachImageBtn');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');

    // --- Вспомогательные функции ---
    function saveToLocalStorage() {
        const dataToStore = {
            posts: posts,
            nextId: nextId,
            likedPosts: Array.from(likedPosts)
        };
        localStorage.setItem('kamil_feed_data', JSON.stringify(dataToStore));
    }

    function loadFromLocalStorage() {
        const saved = localStorage.getItem('kamil_feed_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                posts = parsed.posts || [];
                nextId = parsed.nextId || 1;
                likedPosts = new Set(parsed.likedPosts || []);
                
                posts.forEach(post => {
                    if (!post.comments) post.comments = [];
                    if (post.likes === undefined) post.likes = 0;
                    if (!post.imageData) post.imageData = null;
                    
                    // Обновляем старые комментарии, чтобы у них была структура с ником
                    post.comments.forEach(comment => {
                        if (typeof comment === 'string') {
                            comment = { text: comment, nickname: 'Аноним', date: new Date().toLocaleString() };
                        }
                        if (!comment.nickname) comment.nickname = 'Аноним';
                        if (!comment.date) comment.date = new Date().toLocaleString();
                    });
                });
            } catch(e) { console.warn(e); }
        }
        
        // НЕТ демо-постов - только пустая лента
        if (posts.length === 0) {
            posts = [];
            likedPosts.clear();
            saveToLocalStorage();
        }
    }

    // Конвертация файла в base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Обработка выбора фото
    attachImageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
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

    // --- Рендер всей ленты ---
    function renderFeed() {
        if (!postsContainer) return;
        if (posts.length === 0) {
            postsContainer.innerHTML = `<div class="empty-feed">пока нет постов. создай первый ✨</div>`;
            return;
        }

        let html = '';
        posts.forEach(post => {
            const likeCount = post.likes || 0;
            const commentsArray = post.comments || [];
            const commentsCount = commentsArray.length;
            const isLiked = likedPosts.has(post.id);
            const likeButtonClass = isLiked ? 'like-btn liked' : 'like-btn';
            const likeIcon = isLiked ? '❤️' : '🖤';

            // Фото в посте, если есть
            let imageHtml = '';
            if (post.imageData) {
                imageHtml = `<div class="post-image">
                                <img src="${post.imageData}" alt="post image">
                             </div>`;
            }

            // Генерация блока комментариев с никами
            let commentsHtml = '';
            if (commentsArray.length > 0) {
                commentsHtml = `<div class="comments-section">
                                    <div class="comments-title">💬 комментарии (${commentsCount})</div>`;
                commentsArray.forEach(comment => {
                    const nickname = comment.nickname || 'Аноним';
                    const commentText = comment.text || comment; // для обратной совместимости
                    const commentDate = comment.date || '';
                    
                    commentsHtml += `
                        <div class="comment-item">
                            <div class="comment-header">
                                <span class="comment-author">${escapeHtml(nickname)}</span>
                                ${commentDate ? `<span class="comment-date">${escapeHtml(commentDate)}</span>` : ''}
                            </div>
                            <div class="comment-text">${escapeHtml(commentText)}</div>
                        </div>
                    `;
                });
                commentsHtml += `</div>`;
            } else {
                commentsHtml = `<div class="comments-section">
                                    <div class="comments-title">💬 комментарии (0)</div>
                                    <div class="empty-comments">нет комментариев. добавь эмодзи ⤴️</div>
                                </div>`;
            }

            html += `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <span class="post-id">#${post.id}</span>
                        <span class="post-date">${escapeHtml(post.date) || 'недавно'}</span>
                    </div>
                    <div class="post-content">${escapeHtml(post.content)}</div>
                    ${imageHtml}
                    <div class="post-actions">
                        <button class="${likeButtonClass}" data-id="${post.id}">
                            ${likeIcon} <span class="like-count">${likeCount}</span>
                        </button>
                        <button class="comment-btn" data-id="${post.id}">
                            💬 ${commentsCount}
                        </button>
                    </div>
                    ${commentsHtml}
                </div>
            `;
        });
        postsContainer.innerHTML = html;

        // навесить обработчики на динамические кнопки
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.removeEventListener('click', handleLikeClick);
            btn.addEventListener('click', handleLikeClick);
        });
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.removeEventListener('click', handleCommentClick);
            btn.addEventListener('click', handleCommentClick);
        });
    }

    // Обработчик лайков (переключатель: вкл/выкл)
    function handleLikeClick(e) {
        const btn = e.currentTarget;
        const postId = parseInt(btn.getAttribute('data-id'));
        const post = posts.find(p => p.id === postId);
        
        if (!post) return;
        
        const isCurrentlyLiked = likedPosts.has(postId);
        
        if (isCurrentlyLiked) {
            likedPosts.delete(postId);
            post.likes = Math.max(0, (post.likes || 0) - 1);
        } else {
            likedPosts.add(postId);
            post.likes = (post.likes || 0) + 1;
        }
        
        saveToLocalStorage();
        renderFeed();
    }

    // Открыть модалку для комментария
    function handleCommentClick(e) {
        const btn = e.currentTarget;
        const postId = parseInt(btn.getAttribute('data-id'));
        currentPostIdForComment = postId;
        commentInput.value = '';
        
        // Подставляем последний использованный ник
        if (commentNickname) {
            commentNickname.value = lastUsedNickname;
        }
        
        commentModal.style.display = 'flex';
        // Фокус на поле с ником
        if (commentNickname) commentNickname.focus();
    }

    // Добавить комментарий к посту
    function addCommentToCurrentPost() {
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
        
        // Сохраняем ник для следующих комментариев
        lastUsedNickname = nickname;
        localStorage.setItem('last_comment_nickname', nickname);
        
        const post = posts.find(p => p.id === currentPostIdForComment);
        if (post) {
            if (!post.comments) post.comments = [];
            const newComment = {
                text: commentText,
                nickname: nickname,
                date: new Date().toLocaleString(),
                id: Date.now() + Math.random()
            };
            post.comments.push(newComment);
            saveToLocalStorage();
            renderFeed();
        }
        closeModal();
    }

    function closeModal() {
        commentModal.style.display = 'none';
        currentPostIdForComment = null;
        commentInput.value = '';
        // Не очищаем ник, чтобы он сохранился для следующего раза
    }

    // Создание нового поста с фото
    function createNewPost() {
        const content = postContentInput.value.trim();
        if (content === "" && !currentImageData) {
            alert("Нельзя отправить пустой пост ✧ добавь текст или фото");
            return;
        }
        
        const newPost = {
            id: nextId++,
            content: content || "",
            likes: 0,
            date: new Date().toLocaleString(),
            comments: [],
            imageData: currentImageData || null
        };
        
        posts.unshift(newPost);
        
        // Очищаем форму
        postContentInput.value = '';
        currentImageData = null;
        imagePreviewContainer.style.display = 'none';
        imagePreview.src = '';
        
        saveToLocalStorage();
        renderFeed();
    }

    // простой экранинг для безопасности
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // --- Инициализация событий ---
    function bindEvents() {
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
        
        // Также можно отправлять по Enter в поле ника (переключиться на текст)
        if (commentNickname) {
            commentNickname.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commentInput.focus();
                }
            });
        }
    }

    // --- Старт приложения ---
    function init() {
        loadFromLocalStorage();
        renderFeed();
        bindEvents();
    }

    init();
})();